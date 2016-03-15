import 'babel-polyfill';
import request from 'request';
import uuid from 'uuid';
import { EventEmitter } from 'events';
import { Parser as SparqlParser, Generator as SparqlGenerator } from 'sparqljs';

const aborted = Symbol();

function post(options) {
  let req;

  const promise = new Promise((resolve, reject) => {
    req = request.post(options, (err, response, body) => {
      if (err) {
        reject(err);
      } else {
        resolve({response, body});
      }
    });

    req.on('abort', () => {
      reject(aborted);
    });
  });

  return {
    promise,

    abort() {
      req.abort();
    }
  };
}

const config = Object.freeze({
  maxChunkLimit: 100,
  maxLimit:      10000
});

export default class extends EventEmitter {
  constructor(params) {
    super();

    this.backend     = params.backend;
    this.accept      = params.accept;
    this.timeout     = params.timeout;
    this.parsedQuery = SparqlParser().parse(params.rawQuery);
    this.limit       = Math.min(this.parsedQuery.limit || config.maxLimit, config.maxLimit);
    this.chunkLimit  = Math.min(this.limit, config.maxChunkLimit);

    this.data = {
      ip:       params.ip,
      rawQuery: params.rawQuery,
      reason:   null
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

  run() {
    const chunkOffset = this.parsedQuery.offset || 0;
    const acc         = null;

    return this._req(chunkOffset, acc);
  }

  async _req(chunkOffset, acc) {
    const query = SparqlGenerator().stringify(Object.assign({}, this.parsedQuery, {
      limit:  this.chunkLimit,
      offset: chunkOffset
    }));

    const options = {
      uri: this.backend,
      form: {query},
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': this.accept,
      },
      json: true,
      timeout: this.timeout
    };

    console.log(`REQ limit=${this.limit}, chunkLimit=${this.chunkLimit}, chunkOffset=${chunkOffset}`);

    const {promise, abort} = post(options);

    this.on('cancel', () => {
      this.setReason('canceled');
      abort();
    });

    let result;

    try {
      result = await promise;
    } catch (e) {
      if (e === aborted) {
        const error      = new Error('aborted');
        error.statusCode = 503;
        error.data       = 'Job Canceled';

        throw error;
      } else {
        throw e;
      }
    }

    const {response, body} = result;
    const bindings         = body.results.bindings;

    if (acc) {
      acc.body.results.bindings.push(...bindings);
    } else {
      acc = {
        contentType: response.headers['content-type'],
        body
      };
    }

    const numReturned = bindings.length;
    const nextOffset  = chunkOffset + this.chunkLimit;
    console.log('RET', numReturned);

    if (nextOffset < this.limit && numReturned >= this.chunkLimit) {
      return await this._req(nextOffset, acc);
    } else {
      return acc;
    }
  }
}
