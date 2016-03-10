export default function(strategy, env) {
  const c = require(`./cache/${strategy}`).default;

  return new c(env);
}
