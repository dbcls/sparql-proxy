import Job, { ParseError, QueryTypeError, BackendError } from './job';
import Queue from './queue';
import SocketIo from 'socket.io';
import basicAuth from 'basic-auth-connect';
import bodyParser from 'body-parser';
import cookie from 'cookie';
import cors from 'cors';
import express from 'express';
import fs from 'fs-extra';
import http from 'http';
import morgan from 'morgan';
import multer from 'multer';
import request from 'request';
import { createCacheStore } from './cache';
import { createCompressor } from './compressor';

const app    = express();
const server = http.Server(app);
const io     = SocketIo(server);

const _passthrough          = process.env.PASSTHROUGH === 'true';
const _enableQuerySplitting = !_passthrough && process.env.ENABLE_QUERY_SPLITTING === 'true';

const config = Object.freeze({
  adminPassword:         process.env.ADMIN_PASSWORD || 'password',
  adminUser:             process.env.ADMIN_USER || 'admin',
  backend:               process.env.SPARQL_BACKEND,
  cacheStore:            process.env.CACHE_STORE || 'null',
  compressor:            process.env.COMPRESSOR || 'raw',
  durationToKeepOldJobs: Number(process.env.DURATION_TO_KEEP_OLD_JOBS || 5 * 60 * 1000),
  enableQuerySplitting:  _enableQuerySplitting,
  jobTimeout:            Number(process.env.JOB_TIMEOUT || 5 * 60 * 1000),
  maxChunkLimit:         Number(process.env.MAX_CHUNK_LIMIT || 1000),
  maxConcurrency:        Number(process.env.MAX_CONCURRENCY || 1),
  maxLimit:              Number(process.env.MAX_LIMIT || 10000),
  maxWaiting:            Number(process.env.MAX_WAITING || Infinity),
  passthrough:           _passthrough,
  port:                  Number(process.env.PORT || 3000),
  queryLogPath:          process.env.QUERY_LOG_PATH,
  trustProxy:            process.env.TRUST_PROXY || 'false',
});

const secret = `${config.adminUser}:${config.adminPassword}`;
const cookieKey = 'sparql-proxy-token';

const queue = new Queue(config.maxWaiting, config.maxConcurrency);
setInterval(() => {
  const threshold = new Date() - config.durationToKeepOldJobs;
  queue.sweepOldItems(threshold);
}, 5 * 1000);

if (config.passthrough) {
  console.log('Passthrough mode is enabled. Query filtering and splitting are disabled.');
}

console.log(`cache store: ${config.cacheStore} (compressor: ${config.compressor})`);

const compressor = createCompressor(config.compressor);
const cache      = createCacheStore(config.cacheStore, compressor, process.env);

app.use(morgan('combined'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.text({type: 'application/sparql-query'}));

if (config.trustProxy === 'true') {
  app.enable('trust proxy');
}

app.get('/', (req, res) => {
  res.redirect(`${req.baseUrl}/sparql`);
});

app.all('/sparql', cors(), multer().array(), async (req, res) => {
  if (req.method == 'GET' && req.accepts('html')) {
    res.sendFile('public/app/index.html', {root: `${__dirname}/..`});
  } else if (req.method === 'GET' && Object.keys(req.query).length === 0) {
    await returnServiceDescription(req, res);
  } else {
    await executeQuery(req, res);
  }
});

function returnServiceDescription(req, res) {
  const typeToExt = {
    'application/rdf+xml': 'rdf',
    'text/turtle':         'ttl'
  };

  const matchedType = req.accepts(Object.keys(typeToExt));

  if (matchedType) {
    const ext = typeToExt[matchedType];

    if (fs.pathExistsSync(`${__dirname}/../files/description.${ext}`)) {
      res.type(matchedType).sendFile(`files/description.${ext}`, {root: `${__dirname}/..`});
      return;
    }
  }

  const unsafeHeaders = [
    'authorization',
    'cookie',
    'host',
  ];

  const headers = Object.entries(req.headers).reduce((acc, [k, v]) => {
    return unsafeHeaders.includes(k) ? acc : Object.assign(acc, {[k]: v});
  }, {});

  return new Promise((resolve, reject) => {
    request({
      url: config.backend,
      method: req.method,
      headers
    }).pipe(res).on('finish', resolve).on('error', reject);
  });
}

async function executeQuery(req, res) {
  const startedAt = new Date();
  const log = function(log) {
    if (!config.queryLogPath) { return; }
    const doneAt = new Date();
    const data = Object.assign({
      'started-at': startedAt,
      'done-at': doneAt,
      'elapsed': doneAt - startedAt,
      'ip': req.ip,
    }, log);
    return fs.appendFile(config.queryLogPath, JSON.stringify(data) + "\n");
  };

  let query;

  switch (req.method) {
    case 'GET':
      query = req.query.query;
      break;
    case 'POST':
      if (req.is('urlencoded')) {
        query = req.body.query;
      } else if (req.is('application/sparql-query')) {
        query = req.body;
      } else {
        res.status(415).send('Unsupported Media Type');
        return;
      }

      break;
    case 'OPTIONS':
      res.status(200);
      return;
    default:
      res.status(405).send('Method Not Allowed');
      return;
  }

  if (!query) {
    res.status(400).send({message: 'Query is required'});
    return;
  }

  const token = req.query.token;
  const job = new Job({
    backend: config.backend,
    rawQuery: query,
    accept: config.enableQuerySplitting ? 'application/sparql-results+json' : req.headers.accept,
    timeout: config.jobTimeout,
    ip: req.ip,
    enableQuerySplitting: config.enableQuerySplitting,
    maxLimit: config.maxLimit,
    maxChunkLimit: config.maxChunkLimit,
    passthrough: config.passthrough,
    compressorType: config.compressor,
    cache,
  });

  try {
    const result = await queue.enqueue(job, token);

    res.header('Content-Type', result.contentType);
    res.header('X-Cache', result.cached ? 'hit' : 'miss');
    res.send(result.body);
    log({
      query,
      'cache-hit': result.cached,
      'response': { 'content-type': result.contentType, 'body': result.body }
    });
  } catch (e) {
    console.log('ERROR:', e);

    if (e instanceof ParseError) {
      console.log('==== raw query (before splitting preamble)');
      console.log(e.query);
      console.log('====');

      res.status(400).send({message: e.message});
    } else if (e instanceof QueryTypeError) {
      res.status(400).send({message: e.message});
    } else if (e instanceof BackendError) {
      res.status(e.response.statusCode).contentType(e.response.headers['content-type']).send(e.body);
    } else {
      res.status(e.statusCode || 500).send(e.data || 'ERROR');
    }
  }
}

app.get('/jobs/:token', (req, res) => {
  const js = queue.jobStatus(req.params.token);
  if (!js) {
    res.status(404).send('Job not found');
    return;
  }
  res.send(js);
});

app.get('/admin', basicAuth(config.adminUser, config.adminPassword), (req, res, next) => {
  res.cookie(cookieKey, secret);
  next();
});

app.use(express.static('public'));

if (!config.backend) {
  console.log('you must specify backend');
  process.exit(1);
}

console.log('backend is', config.backend);

io.use((socket, next) => {
  const cookies = cookie.parse(socket.request.headers.cookie);
  const secretProvided = cookies[cookieKey];
  if (secretProvided === secret) {
    next();
  } else {
    console.log(`${socket.id} socket.io authentication failed`);
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`${socket.id} connected`);
  socket.emit('state', queue.state());

  socket.on('disconnect', () => {
    console.log(`${socket.id} disconnected`);
  });

  socket.on('purge_cache', async () => {
    await cache.purge();
    console.log('purged');
  });

  socket.on('cancel_job', (data) => {
    const r = queue.cancel(data.id);
    console.log(`${data.id} cancel request; success=${r}`);
  });

  socket.on('error', (error) => {
    console.log(`socket error: ${error}`);
  });
});

queue.on('state', (state) => {
  io.emit('state', state);
});

server.listen(config.port, () => {
  const port = server.address().port;
  console.log('sparql-proxy listening at', port);
});
