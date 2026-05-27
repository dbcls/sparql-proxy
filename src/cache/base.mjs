export default class {
  constructor(compressor) {
    this.compressor = compressor;
  }

  async serialize(obj) {
    if (Buffer.isBuffer(obj.body)) {
      obj = Object.assign({}, obj, {
        body: obj.body.toString("base64"),
        bodyEncoding: "base64",
      });
    }

    const json = JSON.stringify(obj);

    return await this.compressor.compress(json);
  }

  async deserialize(data) {
    if (!data) { return null; }

    const json = await this.compressor.uncompress(data);
    const obj = JSON.parse(json);

    if (obj.bodyEncoding === "base64") {
      obj.body = Buffer.from(obj.body, "base64");
      delete obj.bodyEncoding;
    }

    return obj;
  }
}
