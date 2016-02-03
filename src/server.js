import express from 'express'
import request from 'request'
import { Parser as SparqlParser } from 'sparqljs'

var app = express();

var port = process.env.PORT || 3000;
var backend = process.env.SPARQL_BACKEND;

app.get('/', function (req, res) {
  res.send('OK');
});

var execute = function(rawQuery, accept, callback) {
  var options = {
    uri: backend,
    json: true,
    form: {query: rawQuery},
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': accept,
    },
  };

  request.post(options, function(error, response, body) {
    if (error) {
      callback(error);
      return;
    }
    if (response.statusCode != 200) {
      var error = new Error("unexpected response from backend");
      callback(error);
      return;
    }
    callback(null, body);
  });
}

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
  var callback = function(err, result) {
    if (err) {
      console.log("ERROR", err);
      res.status(500).send("ERROR");
    }
    res.send(result);
  };
  execute(query, accept, callback);
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
