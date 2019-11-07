import Sparql from 'sparqljs';
import crypto from 'crypto';
import request from 'request';
import { EventEmitter } from 'events';
import { splitPreamble } from './preamble.js';

const {Parser: SparqlParser, Generator: SparqlGenerator} = Sparql;

export class ParseError extends Error {
  constructor(query, cause) {
    super('query parse failed');

    this.query = query;
    this.cause = cause;
  }
}

export class QueryTypeError extends Error {
  constructor(type) {
    super(`query type not allowed: ${type}`);

    this.type = type;
  }
}

export class BackendError extends Error {
  constructor(response, body) {
    super(`unexpected response from backend; ${response.statusCode}`);

    this.response = response;
    this.body     = body;
  }
}

export const aborted = Symbol();

function post(options) {
  let req;
  let userRequestedAbort = false;

  const promise = new Promise((resolve, reject) => {
    req = request.post(options, (err, response, body) => {
      if (err) {
        reject(err);
      } else {
        resolve({ response, body });
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

function isSelectQuery(parsedQuery) {
  return parsedQuery.type === 'query' && parsedQuery.queryType === 'SELECT';
}

function parseQuery(query) {
  const {preamble, compatibleQuery} = splitPreamble(query);

  const parser = new SparqlParser();
  parser._resetBlanks(); // without this, blank node ids differ for every query, that causes cache miss.

  try {
    return {
      preamble,
      parsedQuery: parser.parse(compatibleQuery)
    };
  } catch (e) {
    throw new ParseError(query, e);
  }
}

export default class extends EventEmitter {
  constructor(params) {
    super();

    this.backend              = params.backend;
    this.accept               = params.accept;
    this.timeout              = params.timeout;
    this.rawQuery             = params.rawQuery;
    this.enableQuerySplitting = params.enableQuerySplitting;
    this.passthrough          = params.passthrough;
    this.maxLimit             = params.maxLimit;
    this.maxChunkLimit        = params.maxChunkLimit;
    this.compressorType       = params.compressorType;
    this.cache                = params.cache;

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
    if (this.passthrough) {
      return this.tryCache(this.cacheKey(this.rawQuery), async () => {
        return await this._reqPassthrough(this.rawQuery);
      });
    }

    const {preamble, parsedQuery} = parseQuery(this.rawQuery);

    if (parsedQuery.type !== 'query') {
      throw new QueryTypeError(parsedQuery.type);
    }

    const normalizedQuery = preamble + new SparqlGenerator().stringify(parsedQuery);

    return await this.tryCache(this.cacheKey(normalizedQuery), async () => {
      const limit = Math.min(parsedQuery.limit || this.maxLimit, this.maxLimit);

      if (this.enableQuerySplitting && isSelectQuery(parsedQuery)) {
        const chunkLimit  = Math.min(limit, this.maxChunkLimit);
        const chunkOffset = parsedQuery.offset || 0;

        return await this._reqSplit(preamble, parsedQuery, limit, chunkLimit, chunkOffset);
      } else {
        return await this._reqNormal(preamble, parsedQuery, limit);
      }
    });
  }

  async _reqPassthrough(query) {
    const {response, body} = await this.postQuery(query);

    return {
      contentType: response.headers['content-type'],
      body
    };
  }

  async _reqNormal(preamble, parsedQuery, limit) {
    const override        = isSelectQuery(parsedQuery) ? {limit} : {};
    const compatibleQuery = new SparqlGenerator().stringify(Object.assign({}, parsedQuery, override));
    const query           = preamble + compatibleQuery;

    const {response, body} = await this.postQuery(query);

    return {
      contentType: response.headers['content-type'],
      body
    };
  }

  async _reqSplit(preamble, parsedQuery, limit, chunkLimit, chunkOffset, acc = null) {
    const compatibleQuery = new SparqlGenerator().stringify(Object.assign({}, parsedQuery, {
      limit:  chunkLimit,
      offset: chunkOffset
    }));

    const query = preamble + compatibleQuery;

    console.log(`REQ limit=${limit}, chunkLimit=${chunkLimit}, chunkOffset=${chunkOffset}`);

    const {response, body} = await this.postQuery(query, {json: true});

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
    const nextOffset  = chunkOffset + chunkLimit;

    console.log('RET', numReturned);

    if (nextOffset < limit && numReturned >= chunkLimit) {
      return await this._reqSplit(preamble, parsedQuery, limit, chunkLimit, nextOffset, acc);
    } else {
      return acc;
    }
  }

  async postQuery(query, {json = false} = {}) {
    const {promise, abort} = post({
      uri: this.backend,
      form: {query},
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept':       this.accept
      },
      json,
      timeout: this.timeout
    });

    this.on('abort', abort);

    const {response, body} = await promise;

    if (!isSuccessful(response)) {
      throw new BackendError(response, body);
    }

    return {response, body};
  }

  async tryCache(key, ifnone) {
    let cached = null;

    try {
      cached = await this.cache.get(key);
    } catch (e) {
      console.log('ERROR: in cache get:', e);
    }

    if (cached) {
      return Object.assign(cached, {cached: true});
    }

    const obj = await ifnone();

    try {
      await this.cache.put(key, obj);
    } catch (e) {
      console.log('ERROR: in cache put:', e);
    }

    return Object.assign(obj, {cached: false});
  }

  cacheKey(query) {
    const digest = crypto.createHash('md5').update(query).update("\0").update(this.accept || '').digest('hex');

    return `${digest}.${this.compressorType}`;
  }
}
