import childProcess from 'child_process';
import fetch from 'node-fetch';

const proxyPort   = 9999;
const backendPort = 4568;

let proxyProcess;
let backendProcess;

beforeAll(() => {
  return new Promise((resolve, reject) => {
    proxyProcess = childProcess.spawn(
      'node',
      ['--experimental-modules', 'src/server.js'],
      {
        env: {
          SPARQL_BACKEND: `http://localhost:${backendPort}/sparql`,
          PORT: proxyPort
        }
      }
    );

    proxyProcess.on('exit', () => {
      reject('unexpected sparql-proxy exit');
    });

    proxyProcess.on('error', code => {
      reject(`sparql-proxy error (code ${code})`);
    });

    proxyProcess.stdout.on('data', data => {
      const str = data.toString();

      console.log('PROXY', str);

      if (str.includes('sparql-proxy listening at')) {
        resolve();
      }
    });
  });
});

beforeAll(() => {
  return new Promise((resolve, reject) => {
    backendProcess = childProcess.spawn(
      'ruby',
      ['server.rb'],
      {
        cwd: 'tests/mock-server',
        env: Object.assign({}, process.env, {
          PORT: backendPort
        })
      }
    );

    backendProcess.on('exit', () => {
      reject('unexpected endpoint exit');
    });

    backendProcess.on('error', code => {
      reject(`endpoint error (code ${code})`);
    });

    backendProcess.stderr.on('data', data => {
      const str = data.toString();

      console.log('BACKEND', str);

      if (str.includes('WEBrick::HTTPServer#start')) {
        resolve();
      }
    });
  });
});

afterAll(() => {
  return new Promise((resolve) => {
    if (!proxyProcess) { return; }

    proxyProcess.removeAllListeners('exit');
    proxyProcess.on('exit', resolve);
    proxyProcess.kill();
  });
});

afterAll(() => {
  return new Promise((resolve) => {
    if (!backendProcess) { return; }

    backendProcess.removeAllListeners('exit');
    backendProcess.on('exit', resolve);
    backendProcess.kill();
  });
});

test('GET / should redirect to /sparql', async () => {
  const res = await fetch(`http://localhost:${proxyPort}`, {
    redirect: 'manual'
  });

  expect(res.status).toEqual(302);

  expect(res.headers.get('Location')).toEqual(
    `http://localhost:${proxyPort}/sparql`
  );
});

test('GET /sparql', async () => {
  const url = new URL(`http://localhost:${proxyPort}/sparql`);

  url.searchParams.set('query', 'SELECT * { ?s ?p ?o. }');

  const res = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json'
    }
  });

  expect(res.status).toEqual(200);

  expect(await res.json()).toEqual({
    head: {
      vars: ['s', 'p', 'o']
    },
    results: {
      bindings: [
        {
          s: {type: 'uri',     value: 'http://example.com'},
          p: {type: 'uri',     value: 'http://purl.org/dc/terms/title'},
          o: {type: 'literal', value: 'Hello, world!'}
        }
      ]
    }
  });
});
