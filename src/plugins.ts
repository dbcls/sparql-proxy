import fs from "node:fs/promises";
import path from "node:path";
import { type Query } from "sparqljs";

type SPARQLResult = unknown; // TODO

export type Response = {
  body: SPARQLResult;
  headers: Record<string, string>;
  contentType: string;
};

export type Context = {
  preamble: string;
  query: Query;
};

type Plugin = {
  selectPlugin: PluginFunc | undefined;
  constructPlugin: PluginFunc | undefined;
  askPlugin: PluginFunc | undefined;
  describePlugin: PluginFunc | undefined;
};

type PluginFunc = (ctx: Context, next: PluginFunc) => Promise<Response>;

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
      console.log(`plugin: loading ${resolvedPath}`);
      const plugin = await import(`${resolvedPath}/main`);
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

    let chain = initial;
    for (const plugin of this.plugins.reverse()) {
      const _chain = chain;
      chain = () => {
        let func: PluginFunc | undefined = undefined;
        switch (ctx.query.queryType) {
          case "SELECT":
            func = plugin.selectPlugin;
            break;
          case "CONSTRUCT":
            func = plugin.constructPlugin;
            break;
          case "ASK":
            func = plugin.askPlugin;
            break;
          case "DESCRIBE":
            func = plugin.describePlugin;
            break;
        }
        return func ? func(ctx, _chain) : _chain();
      };
    }

    return await chain();
  }
}
