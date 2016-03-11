export default class {
  constructor(env) {
    this.data = {};
    this.keys = [];
    this.maxEntries = env.MEMORY_MAX_ENTRIES || 100;
  }

  get(key) {
    return Promise.resolve(this.data[key]);
  }

  put(key, obj) {
    if (this.keys.indexOf(key) < 0) {
      this.keys.push(key);
    }

    this.sweepOld();
    this.data[key] = obj;

    return Promise.resolve();
  }

  sweepOld() {
    if (this.keys.length <= this.maxEntries) { return; }

    const key = this.keys.shift();
    console.log(`expire key ${key}`);
    delete this.data[key];
  }
}
