import Memcached from 'memcached';
import denodeify from 'denodeify';

export default class {
  constructor(env) {
    const servers = env.MEMCACHE_SERVERS ? env.MEMCACHE_SERVERS.split(',') : undefined;

    this.client = new Memcached(servers);

    console.log(`memcached is ${this.client.servers.join(', ')}`);
  }

  get(key) {
    return denodeify(this.client.get.bind(this.client))(key).then(JSON.parse).catch(() => null);
  }

  put(key, obj) {
    return denodeify(this.client.set.bind(this.client))(key, JSON.stringify(obj), 0);
  }

  purge() {
    return denodeify(this.client.flush.bind(this.client))();
  }
}
