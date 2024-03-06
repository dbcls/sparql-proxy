import fs from "node:fs/promises";
import path from "node:path";

import { type SelectContext, Response } from "../../src/plugins";
import { type SparqlQuery } from "sparqljs";

function replaceNamedNode(
  obj: any,
  replacer: (before: string) => string,
): SparqlQuery {
  for (const key in obj) {
    const value = obj[key];
    if (typeof value === "object") {
      obj[key] = replaceNamedNode(value, replacer);
    } else {
      if (obj.termType === "NamedNode" && key === "value") {
        obj[key] = replacer(value);
      }
    }
  }
  return obj;
}

function replacePrefix(
  iri: string,
  mappings: [string, string][],
  reverse: boolean,
): string {
  for (const [a, b] of mappings) {
    const from = reverse ? b : a;
    const to = reverse ? a : b;

    if (iri.startsWith(from)) {
      return to + iri.slice(from.length);
    }
  }
  return iri;
}

function rewriteQuery(
  query: SparqlQuery,
  replacer: (before: string) => string,
): SparqlQuery {
  return replaceNamedNode(query, replacer);
}

function rewriteResponse(response, replacer: (before: string) => string) {
  for (const binding of response.body.results.bindings) {
    for (const key in binding) {
      const value = binding[key];
      if (value.type === "uri") {
        binding[key].value = replacer(value.value);
      }
    }
  }
  return response;
}

type Mappings = [string, string][];

async function loadMappingsFromTSV(tsvPath: string): Promise<Mappings> {
  const mappings: Mappings = [];
  const tsv = await fs.readFile(tsvPath, "utf-8");
  const lines = tsv.split("\n");
  for (const line of lines) {
    if (line === "") continue;
    const [from, to] = line.split("\t");
    mappings.push([from, to]);
  }
  return mappings;
}

let mappings: Mappings = [];

async function loadMappings() {
  const filename = "mappings.tsv";
  const __dirname = (import.meta as any).dirname;
  const resolvedTsvPath = path.resolve(__dirname, filename);

  if (!(await fs.stat(resolvedTsvPath).catch((e) => false))) {
    console.log(
      `[replace-prefix] Mappings file {${resolvedTsvPath} is not found, no mappings will be applied.`,
    );
    return;
  }

  console.info(`[replace-prefix] Loading mappings from ${resolvedTsvPath}`);
  mappings = await loadMappingsFromTSV(resolvedTsvPath);
}

await loadMappings();

export async function selectPlugin(
  ctx: SelectContext,
  next: () => Response,
): Promise<Response> {
  // rewrite query
  rewriteQuery(ctx.query, (before) => {
    const after = replacePrefix(before, mappings, false);
    if (before !== after) {
      console.log("[replace-prefix] REPLACE (QUERY)", before, "-->", after);
    }
    return after;
  });

  // issue request
  const resp = await next();

  // rewrite response
  return rewriteResponse(resp, (before) => {
    const after = replacePrefix(before, mappings, true);
    if (before !== after) {
      console.log("[replace-prefix] REPLACE (RESPONSE)", before, "-->", after);
    }
    return after;
  });
}
