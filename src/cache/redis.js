import redis from 'redis'

export default class MemoryCache {
  constructor() {
    this.client = redis.createClient();

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
