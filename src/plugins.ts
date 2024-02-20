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
  pluginsConfPath: string;
  plugins: Plugin[] = [];

  constructor(pluginsConfPath: string) {
    this.pluginsConfPath = pluginsConfPath;
  }

  async loadConfig(): Promise<string[]> {
    const text = await fs.readFile(this.pluginsConfPath, "utf-8");
    const paths: string[] = [];
    for (const line of text.split(/\r?\n/)) {
      if (line === "") continue;
      if (line.startsWith("#")) continue;

      paths.push(line);
    }
    return paths;
  }

  async load() {
    const pluginPaths = await this.loadConfig();
    const plugins: Plugin[] = [];
    for (const dir of pluginPaths) {
      const resolvedPath = path.resolve(dir);
      const plugin = (await import(`${resolvedPath}/main`)).default;
      plugins.push(plugin);
      console.log(`plugin: loaded ${resolvedPath}`);
    }
    this.plugins = plugins;
  }

  async apply(
    ctx: Context,
    initial: () => Promise<Response>,
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
