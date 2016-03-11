export default class {
  constructor(compressor, env) {
    this.maxEntries = env.MEMORY_MAX_ENTRIES || 100;
    this.reset();
  }

  async get(key) {
    return this.data[key];
  }

  async put(key, obj) {
    if (this.keys.indexOf(key) < 0) {
      this.keys.push(key);
    }

    this.sweepOld();
    this.data[key] = obj;
  }

  async purge() {
    this.reset();
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
