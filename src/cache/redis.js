import redis from 'redis';
import denodeify from 'denodeify';
import Base from './base';

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
    const data = await denodeify(this.client.get.bind(this.client))(key);

    return await this.deserialize(data);
  }

  async put(key, obj) {
    const data = await this.serialize(obj);

    await denodeify(this.client.set.bind(this.client))(key, data);
  }

  async purge() {
    await denodeify(this.client.flushdb.bind(this.client))();
  }
}
