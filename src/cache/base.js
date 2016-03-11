export default class {
  constructor(compressor) {
    this.compressor = compressor;
  }

  serialize(obj) {
    return this.compressor.compress(JSON.stringify(obj));
  }

  deserialize(data) {
    if (!data) { return Promise.resolve(null); }

    return this.compressor.uncompress(data).then(JSON.parse).catch(() => null);
  }
}
