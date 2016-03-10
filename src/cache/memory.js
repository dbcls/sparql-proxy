export default class MemoryCache {
  constructor(env) {
    this.data = {};
    this.keys = [];
    this.maxEntries = env.MEMORY_MAX_ENTRIES || 100;
  }

  get(key) {
    return new Promise((resolve, reject) => {
      resolve(this.data[key]);
    });
  }

  put(key, value) {
    return new Promise((resolve, reject) => {
      if (this.keys.indexOf(key) < 0) {
        this.keys.push(key);
      }
      this.sweepOld();
      this.data[key] = value;
      resolve(value);
    });
  }

  sweepOld() {
    if (this.keys.length > this.maxEntries) {
      const key = this.keys.shift();
      console.log(`expire key ${key}`);
      delete this.data[key];
    }
  }
}
