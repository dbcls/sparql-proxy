export function createCompressor(name) {
  const klass = require(`./${name}`).default;

  return new klass();
}
