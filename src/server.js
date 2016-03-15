import express from 'express';
import cookie from 'cookie';
import { Parser as SparqlParser } from 'sparqljs';
import Job from './job';
import SocketIo from 'socket.io';
import Queue from './queue';
import http from 'http';
import crypto from 'crypto';
import basicAuth from 'basic-auth-connect';
import { createCacheStore } from './cache';
import { createCompressor } from './compressor';
import bodyParser from 'body-parser';
import 'babel-polyfill';
import morgan from 'morgan';
import cors from 'cors';

const app    = express();
const server = http.Server(app);
const io     = SocketIo(server);

const config = Object.freeze({
  port:                  process.env.PORT || 3000,
  backend:               process.env.SPARQL_BACKEND,
  maxConcurrency:        process.env.MAX_CONCURRENCY || 1,
  maxWaiting:            process.env.MAX_WAITING || Infinity,
  adminUser:             process.env.ADMIN_USER || 'admin',
  adminPassword:         process.env.ADMIN_PASSWORD || 'password',
  cacheStore:            process.env.CACHE_STORE || 'null',
  compressor:            process.env.COMPRESSOR || 'raw',
  jobTimeout:            process.env.JOB_TIMEOUT || 5 * 60 * 1000,
  durationToKeepOldJobs: process.env.DURATION_TO_KEEP_OLD_JOBS || 60 * 1000,
});

const secret    = config.adminUser + ":" + config.adminPassword;
const cookieKey = 'sparql-proxy-token';

const queue = new Queue(config.maxWaiting, config.maxConcurrency, config.durationToKeepOldJobs);

console.log(`cache store: ${config.cacheStore} (compressor: ${config.compressor})`);
const compressor = createCompressor(config.compressor);
const cache      = createCacheStore(config.cacheStore, compressor, process.env);

app.use(morgan('combined'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.text({type: 'application/sparql-query'}));

app.all('/sparql', cors(), async (req, res) => {
  let query;
  switch (req.method) {
    case "GET":
      query = req.query.query;
      break;
    case "POST":
      if (req.is('application/sparql-query')) {
        query = req.body;
      } else {
        query = req.body.query;
      }
      break;
    case "OPTIONS":
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

  const parser = new SparqlParser();
  let parsedQuery;

  try {
    parsedQuery = parser.parse(query);
  } catch (ex) {
    console.log(ex);
    res.status(400).send({message: 'Query parse failed', data: ex.message});
    return;
  }

  const queryType = parsedQuery.queryType;
  if (parsedQuery.type !== 'query' || queryType !== 'SELECT') {
    console.log(`Query type not allowed: ${parsedQuery.type} (${queryType})`);
    res.status(400).send('Query type not allowed');
    return;
  }

  const accept   = req.header.accept || 'application/sparql-results+json';
  const digest   = crypto.createHash('md5').update(query).update("\0").update(accept).digest('hex');
  const cacheKey = `${digest}.${config.compressor}`;

  try {
    const cached = await cache.get(cacheKey);

    if (cached) {
      console.log('cache hit');
      res.header('Content-Type', cached.contentType);
      res.header('X-Cache', 'hit');
      res.send(cached.body);
      return;
    }
  } catch (error) {
    console.log(`ERROR: in cache get: ${error}`);
  }

  const token = req.query.token;
  const job   = new Job(config.backend, query, accept, config.jobTimeout, req.ip);

  job.on('cancel', () => {
    if (!res.headerSent) {
      res.status(503).send('Job Canceled');
    }
  });

  try {
    const result = await queue.enqueue(job, token);

    res.header('Conten-Type', result.contentType);
    res.send(result.body);

    try {
      await cache.put(cacheKey, result);
    } catch (error) {
      console.log(`ERROR: in cache put: ${error}`);
    }
  } catch (error) {
    console.log(`ERROR: ${error}`);
    res.status(error.statusCode || 500);
    res.send(error.data || 'ERROR');
  }
});

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
