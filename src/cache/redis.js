import redis from 'redis';
import { promisify } from 'util';

import Base from './base.js';

export default class extends Base {
  constructor(compressor, env) {
    super(compressor);

    this.client = redis.createClient({url: env.REDIS_URL, return_buffers: true});

    console.log(`redis is ${this.client.address}`);

    this.client.on('error', (err) => {
      console.log(`redis ERROR: ${err}`);
    });
  }

  async get(key) {
    const data = await promisify(this.client.get.bind(this.client))(key);

    return await this.deserialize(data);
  }

  async put(key, obj) {
    const data = await this.serialize(obj);

    await promisify(this.client.set.bind(this.client))(key, data);
  }

  async purge() {
    await promisify(this.client.flushdb.bind(this.client))();
  }
}
