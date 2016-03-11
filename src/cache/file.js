import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';

export default class {
  constructor(env) {
    this.rootDir = env.CACHE_STORE_PATH;

    if (!this.rootDir) {
      throw new Error('Please set CACHE_STORE_PATH environment variable');
    } else {
      console.log(`cache directory is ${this.rootDir}`);
    }
  }

  get(key) {
    return new Promise((resolve, reject) => {
      fs.readFile(this.getPath(key), (err, data) => {
        err ? resolve(null) : resolve(data);
      });
    });
  }

  put(key, value) {
    return new Promise((resolve, reject) => {
      const _path = this.getPath(key);

      mkdirp(path.dirname(_path), (err) => {
        if (err) {
          reject(err);
        } else {
          fs.writeFile(_path, value, (err) => {
            if (err) {
              reject(err);
            } else {
              resolve(value);
            }
          });
        }
      });
    });
  }

  getPath(key) {
    return path.join(this.rootDir, key[0], key[1], key);
  }
}
