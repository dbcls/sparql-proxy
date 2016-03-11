import Memcached from 'memcached';
import denodeify from 'denodeify';
import Base from './base';

export default class extends Base {
  constructor(compressor, env) {
    super(compressor);

    const servers = env.MEMCACHE_SERVERS ? env.MEMCACHE_SERVERS.split(',') : undefined;

    this.client = new Memcached(servers);

    console.log(`memcached is ${this.client.servers.join(', ')}`);
  }

  get(key) {
    return denodeify(this.client.get.bind(this.client))(key).then(this.deserialize.bind(this));
  }

  put(key, obj) {
    return this.serialize(obj).then((data) => (
      denodeify(this.client.set.bind(this.client))(key, data, 0)
    ));
  }

  purge() {
    return denodeify(this.client.flush.bind(this.client))();
  }
}
