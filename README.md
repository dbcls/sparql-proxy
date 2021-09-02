# sparql-proxy

SPARQL-proxy is a portable Web application that works as a proxy server for any SPARQL endpoint providing the following functionalities:

1. validation of the safety of query statements (omit SPARQL Update queries)
2. job scheduling for a large number of simultaneous SPARQL queries
3. providing a job management interface for time consuming SPARQL queries
4. (optional) cache mechanisms with compression for SPARQL results to improve response time
5. (optional) logging SPARQL queries and results
6. (experimental) splitting a SPARQL query into chunks by adding OFFSET & LIMIT

## Docker

    $ docker run -p 8080:3000 -e SPARQL_BACKEND=http://example.com/sparql ghcr.io/dbcls/sparql-proxy

## Prerequisites

* [Node.js](https://nodejs.org/) 14 or later

## Install and Run

    $ git clone git@github.com:dbcls/sparql-proxy.git
    $ cd sparql-proxy
    $ npm install
    $ npm run build

(Be patient, `npm install` and `npm run build` may take a few minutes)

Then, start SPARQL-proxy:

    $ PORT=3000 SPARQL_BACKEND=http://example.com/sparql ADMIN_USER=admin ADMIN_PASSWORD=password npm start

Open `http://localhost:3000/` on your browser.

Dashboard for administrators is at `http://localhost:3000/admin` .

### Deploy under a subdirectory

If you want to deploy SPARQL-proxy under a subdirectory (say, `/foo/`), pass the directory via `ROOT_PATH` to both `npm build` and `npm start`:

    $ ROOT_PATH=/foo/ npm run build
    $ ROOT_PATH=/foo/ PORT=3000 SPARQL_BACKEND=http://example.com/sparql ADMIN_USER=admin ADMIN_PASSWORD=password npm start

(Note that `ROOT_PATH` must end with `/`.)

Set up your reverse proxy to direct requests to the SPARQL-proxy. If you're using Nginx, configure it as follows:

``` nginx
server {
  location /foo/ {
    proxy_pass http://localhost:3000/foo/;
  }
}
```

If you want to serve `/foo/sparql` as `/sparql`, configure it as follows:

``` nginx
server {
  location /foo/ {
    proxy_pass http://localhost:3000/foo/;
  }

  location /sparql {
    proxy_pass http://localhost:3000/foo/sparql;
  }
}
```

## Configuration

Most configurations are done with environment variables:

### `PORT`

(default: `3000`)

Port to listen on.

### `SPARQL_BACKEND` (required)

URL of the SPARQL backend.

### `ROOT_PATH`

(default: `/`)

If you want to deploy sparql-proxy under a subdirectory (say, `/foo/`), configure `ROOT_PATH` to point the path.

### `ADMIN_USER`

(default: `admin`)

User name for the sparql-proxy administrator.

### `ADMIN_PASSWORD`

(default: `password`)

Password for the sparql-proxy administrator.

### `CACHE_STORE`

(default: `null`)

Cache store. Specify one of the followings:

* `null`: disable caching mechanism.
* `file`: cache in the local files.
* `memory`: cache in the proxy process.
* `redis`: use redis.
* `memcache`: use memcached.

### `COMPRESSOR`

(default: `raw`)

Cache compression algorithm. Specify one of the followings:

* `raw`: disable compression.
* `snappy`: use snappy.

### `CACHE_STORE_PATH`

(only applicable to `CACHE_STORE=file` case)
(default: `/tmp/sparql-proxy/cache`)

Root directory of the cache store.

### `MEMORY_MAX_ENTRIES`

(only applicable to `CACHE_STORE=memory` case)

Maximum number of the entries to keep in the cache.

### `REDIS_URL`

(only applicable to `CACHE_STORE=redis` case)
(default: `localhost:6379`)

Specify URL to the redis server.

### `MEMCACHE_SERVERS`

(only applicable to `CACHE_STORE=memcache` case)
(default: `localhost:11211`)

Specify server locations to the memcache servers (comma-separated).

### `JOB_TIMEOUT`

(default: `300000`)

Job timeout in millisecond.

### `DURATION_TO_KEEP_OLD_JOBS`

(default: `300000`)

Duration in millisecond to keep old jobs in the administrator dashboard.

### `MAX_CONCURRENCY`

(default: `1`)

Number of the concurrent requests.

### `MAX_WAITING`

(default: `Infinity`)

Number of the jobs possible to be waiting.

### `TRUST_PROXY`

(default: `false`)

Set `true` to trust proxies in front of the server.

### `MAX_LIMIT`

(default: `10000`)

Cap the LIMIT of queries.

### `ENABLE_QUERY_SPLITTING`

THIS IS AN EXPERIMENTAL FEATURE.

(default: `false`)

Set `true` to enable query splitting. If enabled, content negotiation will be disabled; sparql-proxy will always use `application/sparql-results+json`. That is because merging results other than JSON is not supported.

### `MAX_CHUNK_LIMIT`

(only applicable to `ENABLE_QUERY_SPLITTING=true` case)
(default: `1000`)

Split queries into the chunk size specified.

### `QUERY_LOG_PATH`

(default: null)

Log queries (and the corresponding responses) to the file, if specified.

### `PASSTHROUGH`

THIS IS AN EXPERIMENTAL FEATURE.

(default: `false`)

Set `true` to enable passthrough mode. If enabled, queries are sent to the backend as is, as far as possible. All of the query validations are bypassed; so the destructive queries can reach the backend.

You should enable this feature only when you understand exactly what you are doing.

## Serving SPARQL Service Description

If you want to serve SPARQL service description, put the descriptions under `files` directory with the name `description.[format]`.

Use `files/description.ttl` for `text/turtle` and `files/description.rdf` for `application/rdf+xml`.

NOTE: If you're running `sparql-proxy` within Docker, you may want to use `-v` option for `docker` command to make the files accessible from the inside of the container:

    $ docker run -p 8080:3000 -e SPARQL_BACKEND=http://example.com/sparql -v `pwd`/files:/app/files dbcls/sparql-proxy


## Relaying `X-SPARQL-` headers

sparql-proxy relays HTTP headers starting with `X-SPARQL-` received from backends. This is intended to pass through `X-SPARQL-MaxRows`, which is emitted from Virtuoso.

If you enabled the query splitting mode, this feature is disabled. This is because a single request to sparql-proxy is split into multiple requests to the backend, and it is not uniquely determined which response header should be returned.
