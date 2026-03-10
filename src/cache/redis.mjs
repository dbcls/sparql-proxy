import { createClient, RESP_TYPES } from "redis";

import Base from "./base.mjs";

export default class extends Base {
  constructor(compressor, env) {
    super(compressor);

    this.client = createClient({
      url: env.REDIS_URL,
    }).withTypeMapping({
      [RESP_TYPES.BLOB_STRING]: Buffer,
    });
    this.client.connect();

    console.log(`redis is ${env.REDIS_URL || "redis://localhost:6379"}`);

    this.client.on("error", (err) => {
      console.log(`redis ERROR: ${err}`);
    });
  }

  async get(key) {
    const data = await this.client.get(key);

    return await this.deserialize(data);
  }

  async put(key, obj) {
    const data = await this.serialize(obj);

    await this.client.set(key, data);
  }

  async purge() {
    await this.client.flushDb();
  }
}
