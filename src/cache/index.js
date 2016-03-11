export function createCacheStore(name, env) {
  const klass = require(`./${name}`).default;

  return new klass(env);
}
