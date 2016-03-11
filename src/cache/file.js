import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import rimraf from 'rimraf';
import denodeify from 'denodeify';
import Base from './base';

export default class extends Base {
  constructor(compressor, env) {
    super(compressor);

    this.rootDir = env.CACHE_STORE_PATH;

    if (!this.rootDir) {
      throw new Error('Please set CACHE_STORE_PATH environment variable');
    } else {
      console.log(`cache directory is ${this.rootDir}`);
    }
  }

  get(key) {
    return denodeify(fs.readFile)(this.getPath(key)).catch(() => null).then(this.deserialize.bind(this));
  }

  put(key, obj) {
    const _path = this.getPath(key);

    return denodeify(mkdirp)(path.dirname(_path)).then(() => (
      this.serialize(obj)
    )).then((data) => (
      denodeify(fs.writeFile)(_path, data)
    ));
  }

  purge() {
    return denodeify(rimraf)(this.rootDir);
  }

  getPath(key) {
    return path.join(this.rootDir, key[0], key[1], key);
  }
}
