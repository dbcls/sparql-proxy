// SPARQL_BACKEND=http://example.com/sparql node request-chunking.js '[SPARQL query]'

import 'babel-polyfill';
import request from 'request';
import {Parser as SparqlParser} from 'sparqljs';
import {Generator as SparqlGenerator} from 'sparqljs';

(() => {
  function post(options) {
    let r;

    const promise = new Promise((resolve, reject) => {
      r = request.post(options, (err, response, body) => {
        if (err) {
          reject(err);
        } else {
          resolve({response, body});
        }
      });
    });

    return {
      r,
      promise
    };
  }

  async function _req(backend, parsedQuery, accept, timeout, limit, chunkLimit, chunkOffset, data) {
    parsedQuery.limit = chunkLimit;
    parsedQuery.offset = chunkOffset;
    const generator = SparqlGenerator();
    const query = generator.stringify(parsedQuery);

    const options = {
      uri: backend,
      form: {query},
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': accept,
      },
      json: true,
      timeout
    };

    console.log("REQ limit=" + limit + ", chunkLimit=" + chunkLimit + ", chunkOffset=" + chunkOffset);

    const {r, promise} = post(options);
    // TODO キャンセルされたとき r を abort する処理
    const {request, body} = await promise;

    const numReturned = body.results.bindings.length;
    const nextOffset = chunkOffset + chunkLimit;
    console.log("RET", numReturned);

    const mergedBindings = data.results.bindings.concat(body.results.bindings);
    data.results.bindings = mergedBindings;

    if (nextOffset < limit && numReturned >= chunkLimit) {
      return await _req(backend, parsedQuery, accept, timeout, limit, chunkLimit, nextOffset, data);
    } else {
      return data;
    }
  }

  const config = {
    maxChunkLimit: 100,
    maxLimit: 10000,
  };

  async function req(backend, query, accept, timeout) {
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

    const data = {
      results: {
        bindings: []
      }
    };

    return await _req(backend, parsedQuery, accept, timeout, limit, chunkLimit, chunkOffset, data);
  };

  const env = process.env;
  const q = process.argv[2];
  const timeout = 5 * 1000;
  const accept = 'application/sparql-results+json';
  const backend = env.SPARQL_BACKEND;

  req(backend, q, accept, timeout).then((data) => {
    console.log("DONE!!!");
    console.log(JSON.stringify(data, null, 2));
    console.log("SIZE", data.results.bindings.length);
  }).catch((err) => {
    console.log("ERROR", err);
  });
})();
