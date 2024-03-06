import fs from "node:fs/promises";
import path from "node:path";
import {
  type Query,
  SelectQuery,
  ConstructQuery,
  AskQuery,
  DescribeQuery,
} from "sparqljs";

type IRI = { type: "uri"; value: string };
type Literal = { type: "literal"; value: string };
type LiteralWithLanguageTag = Literal & { "xml:lang": string };
type LiteralWithDatatypeIRI = Literal & { datatype: string };
type BlankNode = { type: "bnode"; value: string };
type RDFTerm =
  | IRI
  | Literal
  | LiteralWithLanguageTag
  | LiteralWithDatatypeIRI
  | BlankNode;

type Binding = Record<string, RDFTerm>;

export type SPARQLJSONResults = {
  head: {
    vars: string[];
    link?: string[];
  };
  results: {
    bindings: Binding[];
  };
  boolean: never;
};

export type SPARQLBooleanResults = {
  head: {
    link?: string[];
  };
  boolean: boolean;
  results: never;
};

export type SPARQLResults = SPARQLJSONResults | SPARQLBooleanResults;

export type Response = {
  body: SPARQLResults;
  headers: Record<string, string>;
  contentType: string;
};

export type Context = {
  preamble: string;
  query: Query;
};

export type SelectContext = {
  preamble: string;
  query: SelectQuery;
};

export type ConstructContext = {
  preamble: string;
  query: ConstructQuery;
};

export type AskContext = {
  preamble: string;
  query: AskQuery;
};

export type DescribeContext = {
  preamble: string;
  query: DescribeQuery;
};

type Plugin = {
  selectPlugin: PluginFunc | undefined;
  constructPlugin: PluginFunc | undefined;
  askPlugin: PluginFunc | undefined;
  describePlugin: PluginFunc | undefined;
};

type PluginFunc = (ctx: Context, next: PluginFunc) => Promise<Response>;

async function loadPluginConf(
  pluginsConfPath: string,
): Promise<string[] | undefined> {
  let text: string | undefined = undefined;
  try {
    text = await fs.readFile(pluginsConfPath, "utf-8");
  } catch (e) {
    console.log(
      `plugin: plugin configuration ${pluginsConfPath} is not available`,
    );
    return undefined;
  }

  const paths: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line === "") continue;
    if (line.startsWith("#")) continue;

    paths.push(line);
  }
  return paths;
}

export default class Plugins {
  plugins: Plugin[] = [];

  static async load(pluginsConfPath: string): Promise<Plugins | undefined> {
    const plugins = new Plugins();
    const pluginPaths = await loadPluginConf(pluginsConfPath);
    if (!pluginPaths) {
      return undefined;
    }

    for (const dir of pluginPaths) {
      const plugin = await plugins.importPlugin(dir);
      plugins.plugins.push(plugin);
    }

    return plugins;
  }

  async importPlugin(pluginPath: string): Promise<Plugin> {
    const resolvedPath = path.resolve(pluginPath);
    console.log(`plugin: loading ${resolvedPath}`);
    const plugin = import(`${resolvedPath}/main`);
    console.log(`plugin: loaded ${resolvedPath}`);

    return plugin;
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
