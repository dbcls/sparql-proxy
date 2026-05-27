import assert from "assert/strict";
import { spawn } from "child_process";
import http from "http";
import net from "net";
import { after, afterEach, before, test } from "node:test";

const backendPort = 4568;
const proxyPort = 9999;
const queryResponse = {
  head: {
    vars: ["o", "p", "s"],
  },
  metadata: {
    httpRequests: 0,
  },
  results: {
    bindings: [
      {
        s: { type: "uri", value: "http://example.com" },
        p: { type: "uri", value: "http://purl.org/dc/terms/title" },
        o: { type: "literal", value: "Hello, world!" },
      },
    ],
  },
};

let backendServer;
let backendListening = false;
let proxyProcess;
let redisAvailable = false;
let memcacheAvailable = false;

function createBackendServer() {
  return http.createServer(async (req, res) => {
    if (req.url !== "/sparql") {
      res.writeHead(404);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405);
      res.end();
      return;
    }

    const body = await new Promise((resolve, reject) => {
      const chunks = [];

      req.on("data", (chunk) => {
        chunks.push(chunk);
      });
      req.on("end", () => {
        resolve(Buffer.concat(chunks).toString("utf8"));
      });
      req.on("error", reject);
    });

    const params = new URLSearchParams(body);
    if (!params.get("query")) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "Query is required" }));
      return;
    }

    res.writeHead(200, {
      "content-type": "application/sparql-results+json",
    });
    res.end(JSON.stringify(queryResponse));
  });
}

async function listen(server, port) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
}

async function hasTcpService(port) {
  return await new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port });

    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => {
      resolve(false);
    });
    socket.setTimeout(200, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function runProxy(env, cb) {
  proxyProcess = await new Promise((resolve, reject) => {
    const ps = spawn("tsx", ["src/server.mjs"], {
      env: {
        ...process.env,
        SPARQL_BACKEND: `http://127.0.0.1:${backendPort}/sparql`,
        PORT: proxyPort,
        ...env,
      },
      detached: true,
    });

    ps.on("exit", () => {
      reject(new Error("unexpected sparql-proxy exit"));
    });
    ps.on("error", (error) => {
      reject(error);
    });
    ps.stdout.on("data", (data) => {
      if (data.toString().includes("sparql-proxy listening at")) {
        resolve(ps);
      }
    });
    ps.stderr.on("data", (data) => {
      console.error(data.toString());
    });
  });

  const root = new URL(`http://127.0.0.1:${proxyPort}`);

  await cb({
    root,
    endpoint: new URL("/sparql", root),
  });
}

function shouldSkip(env) {
  if (env.CACHE_STORE === "redis" && !redisAvailable) {
    return true;
  }

  if (env.CACHE_STORE === "memcache" && !memcacheAvailable) {
    return true;
  }

  return false;
}

before(async () => {
  backendServer = createBackendServer();
  await listen(backendServer, backendPort);
  backendListening = true;
  redisAvailable = await hasTcpService(6379);
  memcacheAvailable = await hasTcpService(11211);
});

afterEach(async () => {
  if (!proxyProcess) {
    return;
  }

  proxyProcess.removeAllListeners("exit");
  await new Promise((resolve) => {
    proxyProcess.on("exit", () => {
      proxyProcess = null;
      resolve();
    });
    process.kill(-proxyProcess.pid, 9);
  });
});

after(async () => {
  await new Promise((resolve, reject) => {
    if (!backendServer || !backendListening) {
      backendServer = null;
      resolve();
      return;
    }

    backendServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      backendServer = null;
      backendListening = false;
      resolve();
    });
  });
});

test("GET / should redirect to /sparql", async () => {
  await runProxy({}, async ({ root }) => {
    const res = await fetch(root, {
      redirect: "manual",
    });

    assert.equal(res.status, 302);
    assert.equal(res.headers.get("Location"), "/sparql");
  });
});

for (const env of [
  { CACHE_STORE: null },
  { CACHE_STORE: "file", CACHE_STORE_PATH: `tmp/test-cache-${process.pid}` },
  { CACHE_STORE: "memory" },
  { CACHE_STORE: "redis" },
  { CACHE_STORE: "memcache" },
  { COMPRESSOR: "snappy" },
]) {
  test(`GET /sparql (${JSON.stringify(env)})`, async () => {
    if (shouldSkip(env)) {
      return;
    }

    await runProxy(env, async ({ endpoint }) => {
      endpoint.searchParams.set("query", "SELECT * { ?s ?p ?o. }");

      const res = await fetch(endpoint, {
        headers: {
          Accept: "application/sparql-results+json",
        },
      });

      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), queryResponse);
    });
  });
}

test("GET /sparql passthrough with file cache", async () => {
  await runProxy(
    {
      CACHE_STORE: "file",
      CACHE_STORE_PATH: `tmp/test-cache-passthrough-${process.pid}`,
      PASSTHROUGH: "true",
    },
    async ({ endpoint }) => {
      endpoint.searchParams.set("query", "SELECT * { ?s ?p ?o. }");

      const fetchQuery = async () => {
        return await fetch(endpoint, {
          headers: {
            Accept: "application/sparql-results+json",
          },
        });
      };

      const first = await fetchQuery();

      assert.equal(first.status, 200);
      assert.equal(first.headers.get("X-Cache"), "miss");
      assert.deepEqual(await first.json(), queryResponse);

      const second = await fetchQuery();

      assert.equal(second.status, 200);
      assert.equal(second.headers.get("X-Cache"), "hit");
      assert.deepEqual(await second.json(), queryResponse);
    }
  );
});
