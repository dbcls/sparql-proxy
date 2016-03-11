import Memcached from 'memcached';

export default class {
  constructor(env) {
    const servers = env.MEMCACHE_SERVERS ? env.MEMCACHE_SERVERS.split(',') : undefined;

    this.client = new Memcached(servers);

    console.log(`memcached is ${this.client.servers.join(', ')}`);
  }

  get(key) {
    return new Promise((resolve, reject) => {
      this.client.get(key, (err, data) => {
        err ? reject(err) : resolve(data);
      });
    });
  }

  put(key, value) {
    return new Promise((resolve, reject) => {
      this.client.set(key, value, 0, (err) => {
        err ? reject(err) : resolve(value);
      });
    });
  }
}
