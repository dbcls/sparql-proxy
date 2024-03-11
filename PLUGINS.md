# Plugin mechanism

## Overview

The plugin mechanism provides hook points that can be used to intervene in SPARQL Requests and Responses, respectively. This feature allows SPARQL-proxy users (who runs SPARQL-proxy) to write arbitrary scripts to rewrite requests and responses on demand.

Typical use cases include, but are not limited to, rewriting prefixes to improve interoperability, returning specific query results from a hard-coded cache, etc.

## Usage

List the directories of plugins to be used in `files/plugin.conf`. If the line starts with `#`, it is treated as a comment and ignored.

Note that plugins are applied in the order specified in this file. That is, the first plugin in the list receives from the request from the client, then next plugin receives the request from the previous plugin, and so on. Responses are processed in the reverse order.

## Plugin structure

A plugin is a directory that contains a file named `main.ts` or `main.js`. The file exports some functions that are called by the SPARQL-proxy. If nothing is exported, the plugin does nothing. What functions are called and when they are called are described in the following sections.

The plugin directory may contain other files and directories. We recommend to include `README.md` to describe the plugin. Plugin specific configuration files can also be placed in the plugin directory.

For example, the following is a typical structure of a plugin directory:

```
plugins
└── replace-prefix
    ├── main.ts
    ├── mappings.tsv.example
    └── README.md
```

## Noop plugin

The simplest plugin is the noop plugin. It does nothing. To achieve this, just create a directory and place an empty `main.ts` or `main.js` file in it.

```
plugins
└── noop
    └── main.ts
```

Create `files/plugins.conf` which contains the path to the `noop` plugin:

```
# files/plugins.conf
./plugins/noop
```

Then start SPARQL-proxy:


```
❯ SPARQL_BACKEND=https://example.com/sparql npm start

> sparql-proxy@0.0.0 start
> tsx src/server.mjs

cache store: null (compressor: raw)
plugin: loading /home/dara/src/github.com/dbcls/sparql-proxy/plugins/noop
plugin: loaded /home/dara/src/github.com/dbcls/sparql-proxy/plugins/noop
backend is https://example.com/sparql
sparql-proxy listening at 3000
```

The `noop` plugin is successfully loaded and does nothing.

Here, we're going to define a plugin function that still does nothing to demonstrate the plugin mechanism.

```typescript
// plugins/noop/main.ts

import type { SelectContext, Response } from "../../src/plugins";

export async function selectPlugin(
  ctx: SelectContext,
  next: () => Response,
): Promise<Response> {
  const resp = await next();
  return resp;
}
```

`selectPlugin` is called when the SPARQL-proxy receives a SELECT query. It takes two arguments: `ctx` and `next`. `ctx` is a context object that contains the request. `next` is a function that calls the next plugin in the list. The function returns a promise that resolves to a response object.

The following is the same plugin written in JavaScript:

```javascript
// plugins/noop/main.js

export async function selectPlugin(ctx, next) {
  const resp = await next();
  return resp;
}
```

Let's try something a bit more interesting: logging the request and response.

```typescript
// plugins/noop/main.ts

import type { SelectContext, Response } from "../../src/plugins";

export async function selectPlugin(
  ctx: SelectContext,
  next: () => Response,
): Promise<Response> {
  console.log("Context", ctx);
  const resp = await next();
  console.log("Reesponse", resp);
  return resp;
}
```

If you issue a SELECT query to the SPARQL-proxy, you will see the request and response logged in the console, like this:

```text
Context {
  preamble: '',
  query: {
    queryType: 'SELECT',
    variables: [ [Variable], [Variable], [Variable], [Variable] ],
    from: { default: [Array], named: [] },
    where: [ [Object], [Object], [Object], [Object] ],
    limit: 100,
    type: 'query',
    prefixes: {
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      edam: 'http://edamontology.org/',
      pdb: 'http://identifiers.org/pdb/',
      famsbaseo: 'http://purl.jp/bio/01/famsbase/ontology/',
      faldo: 'http://biohackathon.org/resource/faldo#'
    }
  }
}
Reesponse {
  contentType: 'application/sparql-results+json; charset=utf-8',
  headers: {
    date: 'Sat, 02 Mar 2024 01:32:29 GMT',
    server: 'nginx/1.24.0',
    'content-type': 'application/sparql-results+json; charset=utf-8',
    'content-length': '44149',
    'x-powered-by': 'Express',
    'access-control-allow-origin': '*',
    'x-cache': 'hit',
    etag: 'W/"ac75-HoESfLgwbBDtMUVGV/42L1j0clQ"',
    'keep-alive': 'timeout=3, max=1000',
    connection: 'Keep-Alive'
  },
  body: {
    head: { link: [], vars: [Array] },
    results: { distinct: false, ordered: true, bindings: [Array] }
  },
  cached: false
}
```

We can see the `ctx` has two properties: `preamble` and `query`. `preamble` contains a series of `define` statements at the beginning of the query and exists to support certain triple store specific queries. `query` is the parsed query object parsed by [SPARQL.js](https://www.npmjs.com/package/sparqljs). We can modify the request by modifying this object.

`resp` has four properties: `contentType`, `headers`, `body` and `cached`. `contentType` is the content type of the response. `headers` is the HTTP headers of the response. `body` is the body of the response. `cached` indicates whether the response is returned from the cache or not. We can modify the response by returning a new modified response object from `selectPlugin` function.

In the next section, we will write a plugin that modifies the request and response.

## Modifying the request

Now let's implement a plugin that rewrites the request. As an example, write a plugin that sets `LIMIT` to `5` or less for any given query. This is the same as what `MAX_LIMIT` does, which is provided by SPARQL-proxy. It is important to note that MAX_LIMIT is applied after this plugin is executed. This means that if the value of `MAX_LIMIT` is smaller than `5`, it will take precedence.

The `LIMIT` value is contained in the context object. It can be accessed via `ctx.query.limit`. If not specified, it is undefined. If specified, the value is stored. Let's use `Math.min` and rewrite it as follows:

```typescript
// plugins/limit/main.ts

import type { SelectContext, Response } from "../../src/plugins";

export async function selectPlugin(
  ctx: SelectContext,
  next: () => Response,
): Promise<Response> {
  ctx.query.limit = Math.min(ctx.query.limit || Infinity, 5);
  const resp = await next();
  return resp;
}
```

This works as expected. You may want to what actual query is actually issued. We can see the query object by `console.log(ctx.query)`, but you may want to see it as a SPARQL query. To do this, we need to generate a query using `SPARQL.js`'s generator API:

```typescript
// plugins/limit/main.ts

import Sparql from "sparqljs";

import type { SelectContext, Response } from "../../src/plugins";

function stringifyQuery(query) {
  return new Sparql.Generator().stringify(query);
}

export async function selectPlugin(
  ctx: SelectContext,
  next: () => Response,
): Promise<Response> {
  console.log("BEFORE:");
  console.log(stringifyQuery(ctx.query));
  console.log();
  ctx.query.limit = Math.min(ctx.query.limit || Infinity, 5);
  console.log("AFTER:");
  console.log(stringifyQuery(ctx.query));
  console.log();

  const resp = await next();
  return resp;
}
```

The plugin should output logs like the following:

```
BEFORE:
SELECT * WHERE { ?s ?p ?o. }
LIMIT 30

AFTER:
SELECT * WHERE { ?s ?p ?o. }
LIMIT 5
```

You can see that `LIMIT` is rewritten as expected.


## Rewriting the response

Next, let us show an example of rewriting a response. As an example, which is not useful at all, implement a plugin to make all values in SPARQL result uppercase.

The plugin is look like this:

```typescript
// plugins/upcase/main.ts

import type { SelectContext, Response } from "../../src/plugins";

export async function selectPlugin(
  ctx: SelectContext,
  next: () => Response,
): Promise<Response> {
  const resp = await next();

  for (const binding of resp.body.results.bindings) {
    for (const [k, v] of Object.entries(binding)) {
      v.value = v.value.toUpperCase();
    }
  }

  return resp;
}
```

First, it executes `next()` to issue a SPARQL query to the endpoint and receive a normal SPARQL result. Second, modify the received result. This time, we iterated over `bindings` and called `toUpperCase` on the values in them. Now all values (including IRIs) will be returned in uppercase.


## Skipping the request

As a more complex example, let's write a plugin that returns an immediate value when it receives a query containing a COUNT in a specific format without actually executing the query on the endpoint.

Since it is not easy to support flexible queries, we will only consider the following form:

```
SELECT (COUNT(*) AS ?count) WHERE { ?s ?p ?o . }
```

To compare queries, we will consider the parsed results by `SPARQL.js` to be identical when `JSON.stringify()` is applied to them. This is obviously not robust; just adding a prefix or a limit is considered a different query. Even a change in the name of a variable is considered a different query. However, this restriction simplifies the example a lot. That said, since the query is once converted to an abstract syntax tree, it is robust against inserting and deleting white spaces.

The plugin will look like this:

```typescript
// plugins/immediate-response/main.ts

import Sparql from "sparqljs";

import type { SelectContext, Response } from "../../src/plugins";

const targetQuery = "SELECT (COUNT(*) AS ?count) WHERE { ?s ?p ?o . }";
const parsedQuery = new Sparql.Parser().parse(targetQuery);

const precomputedCount = {
  head: { link: [], vars: ["count"] },
  results: {
    distinct: false,
    ordered: true,
    bindings: [
      {
        count: {
          type: "typed-literal",
          datatype: "http://www.w3.org/2001/XMLSchema#integer",
          value: "42",
        },
      },
    ],
  },
};

export async function selectPlugin(
  ctx: SelectContext,
  next: () => Response,
): Promise<Response> {
  console.log(JSON.stringify(ctx, null, 2));

  const sameAsTarget =
    JSON.stringify(ctx.query) === JSON.stringify(parsedQuery);
  if (sameAsTarget) {
    return {
      contentType: "application/sparql-results+json",
      headers: {},
      body: precomputedCount,
    };
  }

  const resp = await next();
  return resp;
}
```

If the query matches with `targetQuery`, then `sameAsTarget` becomes `true` and an early return is made, which results in no call to `next()`. In this case, the client will receive an `precomputedCount`; the count says `42`. No request will be made to the SPARQL endpoint.

In all other cases, the query is dispatched to the SPARQL endpoint as usual.


## Plugin execution order

We have already mentioned that the order in which plug-ins are executed is controlled by the order listed in `plugins.conf`.　Here we will take a closer look at it with two illustrative plugins.

Let's say we have the following two plugins, `foo` and `bar`:

```typescript
// plugins/foo/main.ts

import type { Context, Response } from "../../src/plugins";

export async function selectPlugin(
  ctx: SelectContext,
  next: () => Response,
): Promise<Response> {
  console.log("foo:before");
  const res = await next();
  console.log("foo:after");
  return res;
}
```

```typescript
// plugins/bar/main.ts
import type { Context, Response } from "../../src/plugins";

export async function selectPlugin(
  ctx: SelectContext,
  next: () => Response,
): Promise<Response> {
  console.log("bar:before");
  const res = await next();
  console.log("bar:after");
  return res;
}
```

Then we list them in `plugins.conf` in the following order:

```
# files/plugins.conf
./plugins/foo
./plugins/bar
```

When a query is issued, the following log will be output:

```
foo:before
bar:before
bar:after
foo:after
```

We can think of the plugins listed first in the list as wrapping the results of the plugins listed later.

## Plugin configuration files

Rewrite prefix plugin is shipped with SPARQL-proxy. See `./plugins/rewrite-prefix` for details. This plugin replaces prefixes of IRIs in the query according to the specified rules. It also replaces IRIs in the response in the reverse direction.

The conversion rules are specified by a configuration file described in `mappings.tsv`. It is recommended that the configuration file be placed in the plugin directory. To locate the config file in the same directory as the plugin itself, do the following:

```typescript
  const filename = "mappings.tsv";
  const __dirname = (import.meta as any).dirname;
  const resolvedTsvPath = path.resolve(__dirname, filename);

  // TODO open resolvedTsvPath
```

## Plugin specification reference

### Plugin functions

SPARQL-proxy support these plugin functions corresponding to SPARQL query type:

* `selectPlugin` for `SELECT` query
* `constructPlugin` for `CONSTRUCT` query
* `askPlugin` for `ASK` query
* `describePlugin` for `DESCRIBE` query

SPARQL-proxy expects the functions to be exported by plugins as follows:

```typescript
// plugins/noop/main.ts

import type {
  Response,
  SelectContext,
  ConstructContext,
  AskContext,
  DescribeContext,
} from "../../src/plugins";

export async function selectPlugin(
  ctx: SelectContext,
  next: () => Response
): Promise<Response> {
  const resp = await next();
  return resp;
}

export async function constructPlugin(
  ctx: ConstructContext,
  next: () => Response
): Promise<Response> {
  const resp = await next();
  return resp;
}

export async function askPlugin(
  ctx: AskContext,
  next: () => Response
): Promise<Response> {
  const resp = await next();
  return resp;
}

export async function describePlugin(
  ctx: DescribeContext,
  next: () => Response
): Promise<Response> {
  const resp = await next();
  return resp;
}
```

### Context object

`Context` object has `preamble` and `query`:

```typescript
export type Context = {
  preamble: string;
  query: Query;
};
```

### Response object

`Response` object has `body`, `headers` and `contentType`:

```typescript
export type Response = {
  body: SPARQLResults;
  headers: Record<string, string>;
  contentType: string;
};
```
