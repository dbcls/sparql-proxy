// SPARQL_BACKEND=http://example.com/sparql node request-chunking.js '[SPARQL query]'

import request from 'request';
import {Parser as SparqlParser} from 'sparqljs';
import {Generator as SparqlGenerator} from 'sparqljs';

function _req(backend, parsedQuery, accept, timeout, limit, chunkLimit, chunkOffset) {
  parsedQuery.limit = chunkLimit;
  parsedQuery.offset = chunkOffset;
  var generator = SparqlGenerator();
  var query = generator.stringify(parsedQuery);

  var options = {
    uri: backend,
    form: {query: query},
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': accept,
    },
    json: true,
    timeout: timeout
  };

  console.log("REQ limit=" + limit + ", chunkLimit=" + chunkLimit + ", chunkOffset=" + chunkOffset);
  request.post(options, function(error, response, body) {
    if (error) {
      console.log("ERROR", error);
      return;
    }
    var numReturned = body.results.bindings.length;
    var nextOffset = chunkOffset + chunkLimit;
    console.log("RET", numReturned);
    if (numReturned >= chunkLimit) {
      _req(backend, parsedQuery, accept, timeout, limit, chunkLimit, nextOffset);
    }
  });
}

var config = {
  maxChunkLimit: 100,
  maxLimit: 10000,
};

function req(backend, query, accept, timeout) {
  var parser = SparqlParser();
  var parsedQuery = parser.parse(query);
  var limit = parsedQuery.limit;
  var offset = parsedQuery.offset || 0;

  if (!limit || limit > config.maxLimit) {
    limit = config.maxLimit;
  }

  var chunkLimit = limit;
  if (!chunkLimit || chunkLimit > config.maxChunkLimit) {
    chunkLimit = config.maxChunkLimit;
  }
  var chunkOffset = offset;

  _req(backend, parsedQuery, accept, timeout, limit, chunkLimit, chunkOffset);
};

var env = process.env;
var q = process.argv[2];
var timeout = 5 * 1000;
var accept = 'application/sparql-results+json';
var backend = env.SPARQL_BACKEND;
req(backend, q, accept, timeout);
