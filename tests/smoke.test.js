import childProcess from "child_process";
import fetch from "node-fetch";

let proxyProcess = null;
let backendProcess = null;
const proxyPort = 9999;
const backendPort = 4568;

beforeAll(done => {
  const proxyOptions = {
    env: {
      SPARQL_BACKEND: "http://localhost:" + backendPort + "/sparql",
      PORT: proxyPort
    }
  };
  proxyProcess = childProcess.spawn(
    "node",
    ["--experimental-modules", "src/server.js"],
    proxyOptions
  );
  proxyProcess.on("exit", () => {
    console.error("unexpected sparql-proxy exit");
    process.exit(1);
  });
  proxyProcess.on("error", code => {
    console.error("sparql-proxy error", code);
    process.exit(1);
  });
  proxyProcess.stdout.on("data", data => {
    const str = data.toString();
    console.log("PROXY", str);
    if (str.match(/sparql-proxy listening at /)) {
      done();
    }
  });
});

beforeAll(done => {
  const options = {
    env: Object.assign({}, process.env, {
      PORT: backendPort
    })
  };
  backendProcess = childProcess.spawn(
    "ruby",
    ["tests/mock-server/server.rb"],
    options
  );
  backendProcess.on("exit", () => {
    console.error("unexpected endpoint exit");
    process.exit(1);
  });
  backendProcess.on("error", code => {
    console.error("endpoint error", code);
    process.exit(1);
  });
  backendProcess.stderr.on("data", data => {
    const str = data.toString();
    console.log("BACKEND", str);
    if (str.match(/WEBrick::HTTPServer#start/)) {
      done();
    }
  });
});

afterAll(done => {
  backendProcess.removeAllListeners("exit");
  backendProcess.on("exit", done);
  backendProcess.kill();
});

afterAll(done => {
  proxyProcess.removeAllListeners("exit");
  proxyProcess.on("exit", done);
  proxyProcess.kill();
});

process.on("exit", (code) => {
  if (backendProcess) {
    backendProcess.kill();
  }
  if (proxyProcess) {
    proxyProcess.kill();
  }
});

test("GET / should redirect to /sparql", async () => {
  const res = await fetch("http://localhost:" + proxyPort, {
    redirect: "manual"
  });
  expect(res.status).toEqual(302);
  expect(res.headers.get("location")).toEqual(
    "http://localhost:" + proxyPort + "/sparql"
  );
});

test("GET /sparql", async () => {
  const sparqlQuery = "SELECT * { ?s ?p ?o. }";
  const params = {
    query: sparqlQuery
  };
  const searchParams = new URLSearchParams(Object.entries(params));
  const headers = {
    Accept: "application/sparql-results+json"
  };

  const url = "http://localhost:" + proxyPort + "/sparql?" + searchParams;
  const res = await fetch(url.toString(), { headers });
  expect(res.status).toEqual(200);
  const expected = {
    head: { vars: ["s", "p", "o"] },
    results: {
      bindings: [
        {
          s: { type: "uri", value: "http://example.com" },
          p: { type: "uri", value: "http://purl.org/dc/terms/title" },
          o: { type: "literal", value: "Hello, world!" }
        }
      ]
    }
  };
  expect(await res.json()).toEqual(expected);
});
