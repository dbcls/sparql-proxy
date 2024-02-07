import fs from "node:fs/promises";
import path from "node:path";
import { type SparqlQuery } from "sparqljs";

type SPARQLResult = unknown; // TODO

export type Response = {
  body: SPARQLResult;
  headers: Record<string, string>;
  contentType: string;
};

export type Context = {
  preamble: string;
  query: SparqlQuery;
};

type Plugin = (ctx: Context, next: Plugin) => Promise<Response>;

export default class Plugins {
  pluginsDir: string;
  plugins: Plugin[] = [];

  constructor(pluginsDir: string) {
    this.pluginsDir = pluginsDir;
  }

  async load() {
    const plugins: Plugin[] = [];
    const dirs = await fs.readdir(this.pluginsDir);
    for (const dir of dirs) {
      const resolvedPath = path.resolve(this.pluginsDir, dir);
      const plugin = (await import(resolvedPath + "/main")).default;
      plugins.push(plugin);
      console.log(`plugin: loaded ${this.pluginsDir}/${dir}`);
    }
    this.plugins = plugins;
  }

  async apply(
    ctx: Context,
    initial: () => Promise<Response>
  ): Promise<Response> {
    if (this.plugins.length === 0) {
      return await initial();
    }

    const chain = this.plugins.reduceRight((next, plugin) => {
      return () => plugin(ctx, next);
    });
    return await chain(ctx, initial);
  }
}
