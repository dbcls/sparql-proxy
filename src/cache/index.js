export default function(store, env) {
  const c = require(`./${store}`).default;

  return new c(env);
}
