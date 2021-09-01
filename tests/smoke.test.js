import { expect, test, afterAll, afterEach, beforeAll } from "@jest/globals";
import fetch from "node-fetch";
import { spawn } from "child_process";

let proxyProcess;

async function runProxy(env, cb) {
  const port = 9999;

  proxyProcess = await new Promise((resolve, reject) => {
    const ps = spawn("node", ["--experimental-modules", "src/server.mjs"], {
      env: Object.assign(
        {},
        {
          SPARQL_BACKEND: `http://localhost:${backendPort}/sparql`,
          PORT: port,
        },
        env,
        process.env
      ),
      detached: true,
    });

    ps.on("exit", () => {
      reject("unexpected sparql-proxy exit");
    });

    ps.on("error", (code) => {
      reject(`sparql-proxy error (code ${code})`);
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

  const root = new URL(`http://localhost:${port}`);

  await cb({
    root,
    endpoint: new URL("/sparql", root),
  });
}

afterEach((done) => {
  if (!proxyProcess) {
    done();
    return;
  }
  proxyProcess.removeAllListeners("exit");
  proxyProcess.on("exit", done);
  process.kill(-proxyProcess.pid, 9);
});

const backendPort = 4568;

let backendProcess;

beforeAll(async () => {
  backendProcess = await new Promise((resolve, reject) => {
    const ps = spawn(
      "npx",
      [
        "comunica-sparql-file-http",
        "-p",
        backendPort,
        "tests/fixtures/hello.ttl",
      ],
      { detached: true }
    );

    ps.on("exit", () => {
      reject("unexpected endpoint exit");
    });

    ps.on("error", (code) => {
      reject(`endpoint error (code ${code})`);
    });

    ps.stderr.on("data", (data) => {
      const re = new RegExp(
        `Server worker \\(\\d+\\) running on http://localhost:${backendPort}/sparql`
      );
      if (re.test(data.toString())) {
        resolve(ps);
      }
    });
  });
});

afterAll(async () => {
  await new Promise((resolve) => {
    if (!backendProcess) {
      resolve();
      return;
    }

    backendProcess.removeAllListeners("exit");
    backendProcess.on("exit", resolve);
    process.kill(-backendProcess.pid);
  });
});

test("GET / should redirect to /sparql", async () => {
  await runProxy({}, async ({ root, endpoint }) => {
    const res = await fetch(root, {
      redirect: "manual",
    });

    expect(res.status).toEqual(302);
    expect(res.headers.get("Location")).toEqual(endpoint.toString());
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
  await runProxy(env, async ({ endpoint }) => {
    endpoint.searchParams.set("query", "SELECT * { ?s ?p ?o. }");

    const res = await fetch(endpoint, {
      headers: {
        Accept: "application/sparql-results+json",
      },
    });

    expect(res.status).toEqual(200);

    expect(await res.json()).toEqual({
      head: {
        vars: ["s", "p", "o"],
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
    });
  });
});
