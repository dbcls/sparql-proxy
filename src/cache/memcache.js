import Base from './base';
import Memcached from 'memcached';
import { promisify } from 'util';

export default class extends Base {
  constructor(compressor, env) {
    super(compressor);

    const servers = env.MEMCACHE_SERVERS ? env.MEMCACHE_SERVERS.split(',') : undefined;

    this.client = new Memcached(servers);

    console.log(`memcached is ${this.client.servers.join(', ')}`);
  }

  async get(key) {
    const data = await promisify(this.client.get.bind(this.client))(key);

    return await this.deserialize(data);
  }

  async put(key, obj) {
    const data = await this.serialize(obj);

    await promisify(this.client.set.bind(this.client))(key, data, 0);
  }

  async purge() {
    await promisify(this.client.flush.bind(this.client))();
  }
}
