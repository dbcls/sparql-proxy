export function splitPreamble(rawQuery) {
  let preamble = {};
  const compatibleQuery = rawQuery.replace(/^(?:(?:\s*define\b.*|)\n)*/im, (match) => {
    preamble = match;
    return '';
  })
  return {preamble, compatibleQuery};
}
