import { Generator as SparqlGenerator } from "@traqula/generator-sparql-1-1";
import { Parser as SparqlParser } from "@traqula/parser-sparql-1-1";
import crypto from "crypto";
import { EventEmitter } from "events";

import { splitPreamble } from "./preamble.mjs";

export class ParseError extends Error {
  constructor(query, cause) {
    super("query parse failed");

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
    super(`unexpected response from backend; ${response.status}`);

    this.response = response;
    this.body = body;
  }
}

export const aborted = Symbol();

function post(options) {
  const controller = new AbortController();
  let userRequestedAbort = false;

  const promise = new Promise((resolve, reject) => {
    fetch(options.uri, {
      method: "POST",
      body: new URLSearchParams(options.form),
      headers: options.headers,
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = options.json
          ? await response.json()
          : Buffer.from(await response.arrayBuffer());

        resolve({ response, body });
      })
      .catch((error) => {
        if (userRequestedAbort && error.name === "AbortError") {
          reject(aborted);
          return;
        }

        reject(error);
      });
  });

  const timeout = setTimeout(() => {
    controller.abort();
  }, options.timeout);

  promise.finally(() => {
    clearTimeout(timeout);
  });

  return {
    promise,

    abort() {
      userRequestedAbort = true;
      controller.abort();
    },
  };
}

function isSuccessful(response) {
  return response.status >= 200 && response.status < 300;
}

function isSelectQuery(parsedQuery) {
  return parsedQuery.type === "query" && parsedQuery.subType === "select";
}

function getLimitOffset(query) {
  return query.solutionModifiers.limitOffset || {};
}

function getQueryLimit(query) {
  return getLimitOffset(query).limit;
}

function getQueryOffset(query) {
  return getLimitOffset(query).offset;
}

function withLimitOffset(query, limit, offset) {
  return {
    ...query,
    solutionModifiers: {
      ...query.solutionModifiers,
      limitOffset: {
        type: "solutionModifier",
        subType: "limitOffset",
        limit,
        offset,
        loc: {
          sourceLocationType: "autoGenerate",
        },
      },
    },
  };
}

function defineCompatibleProperty(obj, key, descriptor) {
  if (!Object.prototype.hasOwnProperty.call(obj, key)) {
    Object.defineProperty(obj, key, descriptor);
  }
}

function attachQueryCompatibility(query) {
  if (query.type !== "query") {
    return query;
  }

  defineCompatibleProperty(query, "queryType", {
    configurable: true,
    enumerable: false,
    get() {
      return this.subType.toUpperCase();
    },
  });
  defineCompatibleProperty(query, "limit", {
    configurable: true,
    enumerable: false,
    get() {
      return getQueryLimit(this);
    },
    set(value) {
      this.solutionModifiers.limitOffset = {
        type: "solutionModifier",
        subType: "limitOffset",
        limit: value,
        offset: getQueryOffset(this),
        loc: {
          sourceLocationType: "autoGenerate",
        },
      };
    },
  });
  defineCompatibleProperty(query, "offset", {
    configurable: true,
    enumerable: false,
    get() {
      return getQueryOffset(this);
    },
    set(value) {
      this.solutionModifiers.limitOffset = {
        type: "solutionModifier",
        subType: "limitOffset",
        limit: getQueryLimit(this),
        offset: value,
        loc: {
          sourceLocationType: "autoGenerate",
        },
      };
    },
  });

  return query;
}

function parseQuery(query) {
  const { preamble, compatibleQuery } = splitPreamble(query);

  const parser = new SparqlParser();

  try {
    return {
      preamble,
      parsedQuery: attachQueryCompatibility(parser.parse(compatibleQuery)),
    };
  } catch (e) {
    throw new ParseError(query, e);
  }
}

export default class extends EventEmitter {
  constructor(params) {
    super();

    this.backend = params.backend;
    this.accept = params.accept;
    this.timeout = params.timeout;
    this.rawQuery = params.rawQuery;
    this.enableQuerySplitting = params.enableQuerySplitting;
    this.passthrough = params.passthrough;
    this.maxLimit = params.maxLimit;
    this.maxChunkLimit = params.maxChunkLimit;
    this.compressorType = params.compressorType;
    this.cache = params.cache;

    this.data = {
      ip: params.ip,
      rawQuery: params.rawQuery,
      reason: null,
    };
    this.plugins = params.plugins;
  }

  cancel() {
    this.emit("abort");
  }

  setReason(reason) {
    this.data.reason = reason;
    this.emit("update");
  }

  async run() {
    if (this.passthrough) {
      return this.tryCache(this.cacheKey(this.rawQuery), async () => {
        return await this._reqPassthrough(this.rawQuery);
      });
    }

    const { preamble, parsedQuery } = parseQuery(this.rawQuery);
    if (parsedQuery.type !== "query") {
      throw new QueryTypeError(parsedQuery.type);
    }

    const ctx = { preamble, query: parsedQuery };
    const initial = async () => {
      const normalizedQuery = ctx.preamble + new SparqlGenerator().generate(ctx.query);

      return await this.tryCache(this.cacheKey(normalizedQuery), async () => {
        const limit = Math.min(getQueryLimit(ctx.query) || this.maxLimit, this.maxLimit);

        if (this.enableQuerySplitting && isSelectQuery(ctx.query)) {
          const chunkLimit = Math.min(limit, this.maxChunkLimit);
          const chunkOffset = getQueryOffset(ctx.query) || 0;

          return await this._reqSplit(
            ctx.preamble,
            ctx.query,
            limit,
            chunkLimit,
            chunkOffset
          );
        } else {
          return await this._reqNormal(ctx.preamble, ctx.query, limit);
        }
      });
    };

    if (this.plugins) {
      return await this.plugins.apply(ctx, initial);
    } else {
      return await initial();
    }
  }

  async _reqPassthrough(query) {
    const { response, body } = await this.postQuery(query);

    return {
      contentType: response.headers.get("content-type"),
      headers: Object.fromEntries(response.headers.entries()),
      body,
    };
  }

  async _reqNormal(preamble, parsedQuery, limit) {
    const compatibleQuery = new SparqlGenerator().generate(
      isSelectQuery(parsedQuery)
        ? withLimitOffset(parsedQuery, limit, getQueryOffset(parsedQuery))
        : parsedQuery
    );
    const query = preamble + compatibleQuery;

    const { response, body } = await this.postQuery(query, { json: true });

    return {
      contentType: response.headers.get("content-type"),
      headers: Object.fromEntries(response.headers.entries()),
      body,
    };
  }

  async _reqSplit(
    preamble,
    parsedQuery,
    limit,
    chunkLimit,
    chunkOffset,
    acc = null
  ) {
    const compatibleQuery = new SparqlGenerator().generate(
      withLimitOffset(parsedQuery, chunkLimit, chunkOffset)
    );

    const query = preamble + compatibleQuery;

    console.log(
      `REQ limit=${limit}, chunkLimit=${chunkLimit}, chunkOffset=${chunkOffset}`
    );

    const { response, body } = await this.postQuery(query, { json: true });

    const bindings = body.results.bindings;

    if (acc) {
      acc.body.results.bindings.push(...bindings);
    } else {
      acc = {
        contentType: response.headers.get("content-type"),
        body,
      };
    }

    const numReturned = bindings.length;
    const nextOffset = chunkOffset + chunkLimit;

    console.log("RET", numReturned);

    if (nextOffset < limit && numReturned >= chunkLimit) {
      return await this._reqSplit(
        preamble,
        parsedQuery,
        limit,
        chunkLimit,
        nextOffset,
        acc
      );
    } else {
      return acc;
    }
  }

  async postQuery(query, { json = false } = {}) {
    const { promise, abort } = post({
      uri: this.backend,
      form: { query },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: this.accept,
      },
      json,
      timeout: this.timeout,
    });

    this.on("abort", abort);

    const { response, body } = await promise;

    if (!isSuccessful(response)) {
      throw new BackendError(response, body);
    }

    return { response, body };
  }

  async tryCache(key, ifnone) {
    let cached = null;

    try {
      cached = await this.cache.get(key);
    } catch (e) {
      console.log("ERROR: in cache get:", e);
    }

    if (cached) {
      return Object.assign(cached, { cached: true });
    }

    const obj = await ifnone();

    try {
      await this.cache.put(key, obj);
    } catch (e) {
      console.log("ERROR: in cache put:", e);
    }

    return Object.assign(obj, { cached: false });
  }

  cacheKey(query) {
    const digest = crypto
      .createHash("md5")
      .update(query)
      .update("\0")
      .update(this.accept || "")
      .digest("hex");

    return `${digest}.${this.compressorType}`;
  }
}
