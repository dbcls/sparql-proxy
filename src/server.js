import express from 'express';
import cookie from 'cookie';
import { Parser as SparqlParser } from 'sparqljs';
import Job from './job';
import SocketIo from 'socket.io';
import Queue from './queue';
import http from 'http';
import crypto from 'crypto';
import basicAuth from 'basic-auth-connect';
import Cache from './cache';
import bodyParser from 'body-parser';

const app = express();
const server = http.Server(app);
const io = SocketIo(server);

const port                  = process.env.PORT || 3000;
const backend               = process.env.SPARQL_BACKEND;
const maxConcurrency        = process.env.MAX_CONCURRENCY || 1;
const maxWaiting            = process.env.MAX_WAITING || Infinity;
const adminUser             = process.env.ADMIN_USER || 'admin';
const adminPassword         = process.env.ADMIN_PASSWORD || 'password';
const cacheStrategy         = process.env.CACHE_STRATEGY || 'null';
const jobTimeout            = process.env.JOB_TIMEOUT || 5 * 60 * 1000;
const durationToKeepOldJobs = process.env.DURATION_TO_KEEP_OLD_JOBS || 60 * 1000;

const secret          = adminUser + ":" + adminPassword;
const cookieKey       = 'sparql-proxy-token';

const queue = new Queue(maxWaiting, maxConcurrency, durationToKeepOldJobs);

const cache = new Cache(cacheStrategy, process.env);
console.log(`cache strategy: ${cacheStrategy}`);

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.text({type: 'application/sparql-query'}));

app.all('/sparql', (req, res) => {
  let query;
  switch (req.method) {
    case "GET":
      query = req.query.query;
      break;
    case "POST":
      if (req.body && req.body.query) {
        query = req.body.query;
        break;
      }
      if (req.is('application/sparql-query')) {
        query = req.body;
        break;
      }
      res.status(400);
      break;
    default:
      res.status(405).send('Method Not Allowed');
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

  const accept = req.header.accept || 'application/sparql-results+json';
  const hash = crypto.createHash('sha512');
  const querySignature = hash.update(query).update("\0").update(accept).digest('hex');

  cache.get(querySignature).then((data) => {
    if (data) {
      console.log(`cache hit`);
      res.header('X-Cache', 'hit');
      res.send(data);
    } else {
      const token = req.query.token;
      const job = new Job(backend, query, accept, token, jobTimeout);
      job.on('cancel', () => {
        console.log(`${job.id} job canceled`);
        if (!res.headerSent) {
          res.status(503).send('Job Canceled');
        }
        return;
      });

      const promise = queue.enqueue(job);

      promise.then((result) => {
        res.send(result);
        cache.put(querySignature, result);
      }).catch((error) => {
        console.log(`${job.id} ERROR: ${error}`);
        res.status(error.statusCode || 500);
        res.send(error.data || 'ERROR');
      });
    }
  }).catch((error) => {
    console.log(`${job.id} ERROR: in cache: ${error}`);
    res.status(error.statusCode || 500);
    res.send(error.data || 'ERROR');
  });
});

app.get('/jobs/:token', (req, res) => {
  const js = queue.jobStatus(req.params.token);
  if (!js) {
    res.status(404).send('Job not found');
    return;
  }
  res.send(js);
});

app.get('/admin', basicAuth(adminUser, adminPassword), (req, res, next) => {
  res.cookie(cookieKey, secret);
  next();
});

app.use(express.static('public'));

if (!backend) {
  console.log('you must specify backend');
  process.exit(1);
}

console.log('backend is', backend);

io.use((socket, next) => {
  const cookies = cookie.parse(socket.request.headers.cookie);
  const secretProvided = cookies[cookieKey];
  if (secretProvided == secret) {
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

  socket.on('cancel_job', (data) => {
    const r = queue.cancel(data.id);
    console.log(`${data.id} cancel request; success=${r}`);
  });
});

queue.on('state', (state) => {
  io.emit('state', state);
});

server.listen(port, () => {
  const port = server.address().port;
  console.log('sparql-proxy listening at', port);
});
