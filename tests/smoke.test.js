import { afterAll, afterEach, beforeAll, expect, test } from "@jest/globals";
import { spawn } from "child_process";
import http from "http";
import net from "net";

import fetch from "node-fetch";

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

beforeAll(async () => {
  backendServer = createBackendServer();
  await listen(backendServer, backendPort);
  redisAvailable = await hasTcpService(6379);
  memcacheAvailable = await hasTcpService(11211);
});

afterEach((done) => {
  if (!proxyProcess) {
    done();
    return;
  }

  proxyProcess.removeAllListeners("exit");
  proxyProcess.on("exit", () => {
    proxyProcess = null;
    done();
  });
  process.kill(-proxyProcess.pid, 9);
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    if (!backendServer) {
      resolve();
      return;
    }

    backendServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      backendServer = null;
      resolve();
    });
  });
});

test("GET / should redirect to /sparql", async () => {
  await runProxy({}, async ({ root }) => {
    const res = await fetch(root, {
      redirect: "manual",
    });

    expect(res.status).toEqual(302);
    expect(res.headers.get("Location")).toEqual("/sparql");
  });
});

test.each([
  { CACHE_STORE: null },
  { CACHE_STORE: "file", CACHE_STORE_PATH: `tmp/test-cache-${process.pid}` },
  { CACHE_STORE: "memory" },
  { CACHE_STORE: "redis" },
  { CACHE_STORE: "memcache" },
  { COMPRESSOR: "snappy" },
])("GET /sparql (env: %p)", async (env) => {
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

    expect(res.status).toEqual(200);
    expect(await res.json()).toEqual(queryResponse);
  });
});
