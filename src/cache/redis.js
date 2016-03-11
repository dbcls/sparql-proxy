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

  get(key) {
    return denodeify(this.client.get.bind(this.client))(key).then(this.deserialize.bind(this));
  }

  put(key, obj) {
    return this.serialize(obj).then((data) => (
      denodeify(this.client.set.bind(this.client))(key, data)
    ));
  }

  purge() {
    return denodeify(this.client.flushdb.bind(this.client))();
  }
}
