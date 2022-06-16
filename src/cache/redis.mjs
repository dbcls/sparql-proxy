import { createClient } from "redis";

import Base from "./base.mjs";

export default class extends Base {
  constructor(compressor, env) {
    super(compressor);

    this.client = createClient({
      url: env.REDIS_URL,
      return_buffers: true,
    });
    this.client.connect();

    console.log(`redis is ${this.client.address}`);

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
