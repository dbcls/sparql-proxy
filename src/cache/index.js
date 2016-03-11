export function createCacheStore(name, compressor, env) {
  const klass = require(`./${name}`).default;

  return new klass(compressor, env);
}
