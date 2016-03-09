import redis from 'redis'

export default class MemoryCache {
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
    return new Promise((resolve, reject) => {
      this.client.get(key, (err, res) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
  }

  put(key, value) {
    return new Promise((resolve, reject) => {
      this.client.set(key, value, (err, res) => {
        if (err) {
          reject(err);
          return;
        }
      });
      resolve(value);
    });
  }
}
