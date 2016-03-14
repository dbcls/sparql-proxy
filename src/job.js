import request from 'request'
import uuid from 'uuid'
import { EventEmitter } from 'events'
import {Parser as SparqlParser} from 'sparqljs';
import {Generator as SparqlGenerator} from 'sparqljs';

const config = {
  maxChunkLimit: 100,
  maxLimit: 10000,
};

export default class extends EventEmitter {
  constructor(backend, rawQuery, accept, timeout, ip) {
    super();

    this.backend = backend;
    this.rawQuery = rawQuery;
    this.accept = accept;
    this.timeout = timeout;

    this.data = {
      ip: ip,
      rawQuery: rawQuery,
      reason: null
    };
  }

  canceled() {
    // STATE: canceled
    this.emit('cancel');
  }

  setReason(reason) {
    this.data.reason = reason;
    this.emit('update');
  }

  _req(backend, parsedQuery, accept, timeout, limit, chunkLimit, chunkOffset) {
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
    return new Promise((resolve, reject) => {
      request.post(options, (error, response, body) => {
        if (error) {
          reject(error);
          return;
        }
        const numReturned = body.results.bindings.length;
        const nextOffset = chunkOffset + chunkLimit;
        console.log("RET", numReturned);
        let nextPromise = Promise.resolve();
        if (nextOffset < limit && numReturned >= chunkLimit) {
          nextPromise = this._req(backend, parsedQuery, accept, timeout, limit, chunkLimit, nextOffset);
        }

        nextPromise.then((data) => {
          if (data) {
            const mergedBindings = data.body.results.bindings.concat(body.results.bindings);
            data.body.results.bindings = mergedBindings;
            resolve(data);
          } else {
            resolve({contentType: response.headers['content-type'], body});
          }
        }).catch((err) => {
          reject(err);
        });
      });
    });
  }

  run() {
    const parser = SparqlParser();
    const parsedQuery = parser.parse(this.rawQuery);
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

    return this._req(this.backend, parsedQuery, this.accept, this.timeout, limit, chunkLimit, chunkOffset);
  }
}
