# sparql-proxy

## Prerequisites

* [Node.js](https://nodejs.org/)

## Install

    $ git clone git@github.com:enishitech/sparql-proxy.git
    $ cd sparql-proxy
    $ npm install

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

### `CACHE_STRATEGY`

(default: `null`)

Cache strategy. Specify one of the followings:

* `null`: disable caching mechanism.
* `memory`: cache in the proxy process.
* `redis`: use redis.

### `REDIS_URL`

(only applicable to `CACHE_STRATEGY=redis` case)

Specify URL to the redis server.

### `MEMORY_MAX_ENTRIES`

(only applicable to `CACHE_STRATEGY=memory` case)

Maximum number of the entries to keep in the cache.

### `JOB_TIMEOUT`

(default: `300000`)

Job timeout in millisecond.

### `DURATION_TO_KEEP_OLD_JOBS`

(default: `60000`)

Duration to keep old jobs in the administrator dashboard.

### `MAX_CONCURRENCY`

(default: `1`)

Number of the concurrent requests.

### `MAX_WAITING`

(default: `Infinity`)

Number of the jobs possible to be waiting.
