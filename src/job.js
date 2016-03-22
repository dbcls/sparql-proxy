import 'babel-polyfill';
import request from 'request';
import uuid from 'uuid';
import { EventEmitter } from 'events';
import { Parser as SparqlParser, Generator as SparqlGenerator } from 'sparqljs';

export const aborted = Symbol();

function post(options) {
  let req;
  let userRequestedAbort = false;

  const promise = new Promise((resolve, reject) => {
    req = request.post(options, (err, response, body) => {
      if (err) {
        reject(err);
      } else {
        resolve({response, body});
      }
    });

    req.on('abort', () => {
      if (userRequestedAbort) {
        reject(aborted);
      }
    });
  });

  return {
    promise,

    abort() {
      userRequestedAbort = true;
      req.abort();
    }
  };
}

function isSuccessful(response) {
  return response.statusCode >= 200 && response.statusCode < 300;
}

export default class extends EventEmitter {
  constructor(params) {
    super();

    this.backend              = params.backend;
    this.accept               = params.accept;
    this.timeout              = params.timeout;
    this.rawQuery             = params.rawQuery;
    this.enableQuerySplitting = params.enableQuerySplitting;
    this.parsedQuery          = new SparqlParser().parse(this.rawQuery);
    this.limit                = Math.min(this.parsedQuery.limit || params.maxLimit, params.maxLimit);
    this.chunkLimit           = Math.min(this.limit, params.maxChunkLimit);

    this.data = {
      ip:       params.ip,
      rawQuery: params.rawQuery,
      reason:   null
    };
  }

  cancel() {
    this.emit('abort');
  }

  setReason(reason) {
    this.data.reason = reason;
    this.emit('update');
  }

  async run() {
    if (this.enableQuerySplitting && this.isSelectQuery()) {
      const chunkOffset = this.parsedQuery.offset || 0;

      return await this._reqSplit(chunkOffset);
    } else {
      return await this._reqNormal();
    }
  }

  isSelectQuery() {
    return this.parsedQuery.type === "query" && this.parsedQuery.queryType === "SELECT";
  }

  limitCappedQuery() {
    let query = Object.assign({}, this.parsedQuery);
    if (this.isSelectQuery()) {
      Object.assign(query, {limit: this.limit});
    }
    return new SparqlGenerator().stringify(query);
  }

  async _reqNormal() {
    const query = this.limitCappedQuery();

    const options = {
      uri: this.backend,
      form: {query},
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': this.accept,
      },
      timeout: this.timeout
    };

    const {promise, abort} = post(options);

    this.on('abort', abort);

    const {response, body} = await promise;

    if (!isSuccessful(response)) {
      console.log(body);
      throw new Error(`unexpected response from backend; ${response.statusCode}`);
    }

    return {
      contentType: response.headers['content-type'],
      body
    };
  }

  async _reqSplit(chunkOffset, acc = null) {
    const query = this.limitCappedQuery();

    const options = {
      uri: this.backend,
      form: {query},
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json',
      },
      json: true,
      timeout: this.timeout
    };

    console.log(`REQ limit=${this.limit}, chunkLimit=${this.chunkLimit}, chunkOffset=${chunkOffset}`);

    const {promise, abort} = post(options);

    this.on('abort', abort);

    const {response, body} = await promise;

    if (!isSuccessful(response)) {
      throw new Error(`unexpected response from backend; ${response.statusCode}`);
    }

    const bindings = body.results.bindings;

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
      return await this._reqSplit(nextOffset, acc);
    } else {
      return acc;
    }
  }
}
