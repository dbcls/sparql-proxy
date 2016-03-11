export default class {
  constructor(compressor) {
    this.compressor = compressor;
  }

  async serialize(obj) {
    const json = JSON.stringify(obj);

    return await this.compressor.compress(json);
  }

  async deserialize(data) {
    if (!data) { return null; }

    const json = await this.compressor.uncompress(data);

    return JSON.parse(json);
  }
}
