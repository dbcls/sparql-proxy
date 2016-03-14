// SPARQL_BACKEND=http://example.com/sparql node request-chunking.js '[SPARQL query]'

import request from 'request';
import {Parser as SparqlParser} from 'sparqljs';
import {Generator as SparqlGenerator} from 'sparqljs';

function _req(backend, parsedQuery, accept, timeout, limit, chunkLimit, chunkOffset) {
  parsedQuery.limit = chunkLimit;
  parsedQuery.offset = chunkOffset;
  const generator = SparqlGenerator();
  const query = generator.stringify(parsedQuery);

  const options = {
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
    const numReturned = body.results.bindings.length;
    const nextOffset = chunkOffset + chunkLimit;
    console.log("RET", numReturned);
    if (numReturned >= chunkLimit) {
      _req(backend, parsedQuery, accept, timeout, limit, chunkLimit, nextOffset);
    }
  });
}

const config = {
  maxChunkLimit: 100,
  maxLimit: 10000,
};

function req(backend, query, accept, timeout) {
  const parser = SparqlParser();
  const parsedQuery = parser.parse(query);
  let limit = parsedQuery.limit;
  const offset = parsedQuery.offset || 0;

  if (!limit || limit > config.maxLimit) {
    limit = config.maxLimit;
  }

  let chunkLimit = limit;
  if (!chunkLimit || chunkLimit > config.maxChunkLimit) {
    chunkLimit = config.maxChunkLimit;
  }
  const chunkOffset = offset;

  _req(backend, parsedQuery, accept, timeout, limit, chunkLimit, chunkOffset);
};

const env = process.env;
const q = process.argv[2];
const timeout = 5 * 1000;
const accept = 'application/sparql-results+json';
const backend = env.SPARQL_BACKEND;
req(backend, q, accept, timeout);
