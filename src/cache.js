export default class Cache {
  constructor() {
    this.data = {};
  }

  get(key) {
    return new Promise((resolve, reject) => {
      resolve(this.data[key]);
    });
  }

  put(key, value) {
    return new Promise((resolve, reject) => {
      this.data[key] = value;
      resolve(value);
    });
  }
}
