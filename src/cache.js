import NullCache from './cache/null';
import MemoryCache from './cache/memory';

const strategies = {
  "memory": MemoryCache,
  "null": NullCache
};

export default (strategy, options) => {
  const c = strategies[strategy];

  if (!c) {
    throw new Error(`unsupported cache strategy ${strategy}`);
  }
  return new c(options);
}
