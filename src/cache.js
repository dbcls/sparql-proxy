export default function(store, env) {
  const c = require(`./cache/${store}`).default;

  return new c(env);
}
