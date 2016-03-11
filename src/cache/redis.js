import redis from 'redis';
import denodeify from 'denodeify';

export default class {
  constructor(env) {
    const redisUrl = env.REDIS_URL;
    if (redisUrl) {
      console.log(`redis is ${redisUrl}`);
    }
    this.client = redis.createClient(redisUrl);

    this.client.on('error', (err) => {
      console.log(`redis ERROR: ${err}`);
    });
  }

  get(key) {
    return denodeify(this.client.get.bind(this.client))(key).then(JSON.parse).catch(() => null);
  }

  put(key, obj) {
    return denodeify(this.client.set.bind(this.client))(key, JSON.stringify(obj));
  }

  purge() {
    return denodeify(this.client.flushdb.bind(this.client))();
  }
}
