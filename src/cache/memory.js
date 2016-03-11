export default class {
  constructor(env) {
    this.maxEntries = env.MEMORY_MAX_ENTRIES || 100;
    this.reset();
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

  purge() {
    this.reset();

    return Promise.resolve();
  }

  reset() {
    this.data = {};
    this.keys = [];
  }

  sweepOld() {
    if (this.keys.length <= this.maxEntries) { return; }

    const key = this.keys.shift();
    console.log(`expire key ${key}`);
    delete this.data[key];
  }
}
