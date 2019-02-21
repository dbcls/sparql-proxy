import snappy from 'snappy';
import { promisify } from 'util';

export default class {
  compress(data) {
    return promisify(snappy.compress)(data);
  }

  uncompress(data) {
    return promisify(snappy.uncompress)(data);
  }
}
