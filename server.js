var express = require('express');
var request = require('request');
var app = express();

var SparqlParser = require('sparqljs').Parser;

var port = process.env.PORT || 3000;
var backend = process.env.SPARQL_BACKEND;

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

  console.log(parsedQuery);

  var queryType = parsedQuery.queryType;
  if (parsedQuery.type != "query" || queryType != "SELECT") {
    console.log("Query type not allowed: " + parsedQuery.type + "(" + queryType + ")");
    res.status(400).send("Query type not allowed");
    return;
  }

  var options = {
    uri: backend,
    json: true,
    form: {query: query, format: "json"},
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': req.header.Accept || 'application/sparql-results+json',
    },
  };

  request.post(options, function(error, response, body) {
    if (error) {
      console.log(error);
      res.status(500).send("ERROR");
      return;
    }
    if (response.statusCode != 200) {
      console.log(body);
      res.status(500).send("ERROR");
      return;
    }
    res.send(body);
  });
});

console.log('backend is', backend);
var server = app.listen(port, function () {
  var port = server.address().port;
  console.log('sparql-proxy listening at', port);
});
