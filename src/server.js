import express from 'express';
import { Parser as SparqlParser } from 'sparqljs';
import Job from './job';
import SocketIo from 'socket.io';
import Queue from './queue';
import http from 'http';

const app = express();
const server = http.Server(app);
const io = SocketIo(server);

const port = process.env.PORT || 3000;
const backend = process.env.SPARQL_BACKEND;
const queue = new Queue();

app.use(express.static('public'));

app.get('/sparql', (req, res) => {
  const query = req.query.query;
  const parser = new SparqlParser();
  let parsedQuery;
  const format = req.query.format;

  try {
    parsedQuery = parser.parse(query);
  } catch (ex) {
    console.log(ex);
    res.status(400).send('Query parse failed');
    return;
  }

  const queryType = parsedQuery.queryType;
  if (parsedQuery.type !== 'query' || queryType !== 'SELECT') {
    console.log(`Query type not allowed: ${parsedQuery.type} (${queryType})`);
    res.status(400).send('Query type not allowed');
    return;
  }

  const accept = req.header.accept || 'application/sparql-results+json';
  const job = new Job(backend, query, accept);
  const promise = queue.enqueue(job);

  promise.then((result) => {
    res.send(result);
    return result;
  }).catch((error) => {
    console.log("ERROR", error);
    res.status(500).send('ERROR');
  });
});

if (!backend) {
  console.log('you must specify backend');
  process.exit(1);
}

console.log('backend is', backend);

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
