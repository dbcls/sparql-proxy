# Plugin mechanism

## Overview

The plugin mechanism provides hook points that can be used to intervene in SPARQL Requests and Responses, respectively. This feature allows SPARQL-proxy users (who runs SPARQL-proxy) to write arbitrary scripts to rewrite requests and responses on demand.

Typical use cases include, but are not limited to, rewriting prefixes to improve interoperability, returning specific query results from a hard-coded cache, etc.

## Usage

List the directories of plugins to be used in `plugin.conf`. If the line starts with `#`, it is treated as a comment and ignored.

Then specify the path to `plugin.conf` to `PLUGINS` environment variable when starting the SPARQL-proxy. For example, `PLUGINS=/path/to/plugin.conf`. This will activate the plugin mechanism.

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

Create `plugins.conf` which contains the path to the `noop` plugin:

```
./plugins/noop
```

Then start the SPARQL-proxy with `PLUGINS` environment variable:


```
❯ PLUGINS=./plugins.conf SPARQL_BACKEND=https://example.com/sparql npm start

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

import { type Context, Response } from "../../src/plugins";

export async function selectPlugin(
  ctx: Context,
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

import { type Context, Response } from "../../src/plugins";

export async function selectPlugin(
  ctx: Context,
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

We can see the `ctx` has two properties: `preamble` and `query`. `preamble` is the part of the comments before the query. `query` is the parsed query object parsed by [SPARQL.js](https://www.npmjs.com/package/sparqljs). We can modify the request by modifying this object.

`resp` has four properties: `contentType`, `headers`, `body` and `cached`. `contentType` is the content type of the response. `headers` is the HTTP headers of the response. `body` is the body of the response. `cached` indicates whether the response is returned from the cache or not. We can modify the response by returning a new modified response object from `selectPlugin` function.

In the next section, we will write a plugin that modifies the request and response.

## Modifying the request and response

