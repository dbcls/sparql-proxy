import express from 'express'
import { Parser as SparqlParser } from 'sparqljs'
import Job from './job'
import Tracker from './tracker'

var app = express();

var port = process.env.PORT || 3000;
var backend = process.env.SPARQL_BACKEND;
var tracker = new Tracker();

app.get('/', function (req, res) {
  res.send('OK');
});

app.get('/sparql', function (req, res) {
  var query = req.query.query;
  var parser = new SparqlParser();
  var parsedQuery;
  var format = req.query.format;

  try {
    parsedQuery = parser.parse(query);
  } catch(ex) {
    console.log(ex);
    res.status(400).send("Query parse failed");
    return;
  }

  var queryType = parsedQuery.queryType;
  if (parsedQuery.type != "query" || queryType != "SELECT") {
    console.log("Query type not allowed: " + parsedQuery.type + "(" + queryType + ")");
    res.status(400).send("Query type not allowed");
    return;
  }

  var accept = req.header.accept || 'application/sparql-results+json';
  let job = new Job(backend, query, accept);
  let promise = tracker.enqueue(job);

  promise.then((result) => {
    res.send(result);
  }).catch((error) => {
    res.status(500).send("ERROR");
  });
});

if (!backend) {
  console.log('you must specify backend');
  process.exit(1);
}

console.log('backend is', backend);
var server = app.listen(port, function () {
  var port = server.address().port;
  console.log('sparql-proxy listening at', port);
});
