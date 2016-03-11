import snappy from 'snappy';
import denodeify from 'denodeify';

export default class {
  compress(data) {
    return denodeify(snappy.compress)(data);
  }

  uncompress(data) {
    return denodeify(snappy.uncompress)(data);
  }
}
