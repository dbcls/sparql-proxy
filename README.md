# sparql-proxy

SPARQL-proxy is a portable Web application that works as a proxy server for any SPARQL endpoint providing the following functionalities:

1. validation of the safety of query statements (omit SPARQL Update queries)
2. job scheduling for a large number of simultaneous SPARQL queries
3. providing a job management interface for time consuming SPARQL queries
4. (optional) cache mechanisms with compression for SPARQL results to improve response time
5. (optional) logging SPARQL queries and results
6. (experimental) splitting a SPARQL query into chunks by adding OFFSET & LIMIT

## Docker

    $ docker run -p 8080:3000 -e SPARQL_BACKEND=http://example.com/sparql dbcls/sparqlist

## Prerequisites

* [Node.js](https://nodejs.org/)

## Install

    $ git clone git@github.com:dbcls/sparql-proxy.git
    $ cd sparql-proxy
    $ npm install

(Be patient, `npm install` may take a few minutes)

## Run

    $ PORT=3000 SPARQL_BACKEND=http://example.com/sparql ADMIN_USER=admin ADMIN_PASSWORD=password npm start

Open `http://localhost:3000/` on your browser.

Dashboard for administrators is at `http://localhost:3000/admin` .

## Configuration

All configurations are done with environment variables.

### `PORT`

(default: `3000`)

Port to listen on.

### `SPARQL_BACKEND` (required)

URL of the SPARQL backend.

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

## `MEMCACHE_SERVERS`

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

Set `true` to enable query splitting. If enabled, content negotiation will be disabled; spaql-proxy will always use `application/sparql-results+json`. That is because merging results other than JSON is not supported.

### `MAX_CHUNK_LIMIT`

(only applicable to `ENABLE_QUERY_SPLITTING=true` case)
(default: `1000`)

Split queries into the chunk size specified.

### `QUERY_LOG_PATH`

(default: null)

Log queries (and the corresponding responses) to the file, if specified.
