import babelParser from "@babel/eslint-parser";
import js from "@eslint/js";
import globals from "globals";
import reactPlugin from "eslint-plugin-react";

export default [
  {
    ignores: ["public/**"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.mjs", "client/**/*.jsx", "tests/**/*.js"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        babelOptions: {
          presets: ["@babel/preset-react"],
        },
        ecmaVersion: 2018,
        requireConfigFile: false,
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react: reactPlugin,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      "no-console": "off",
      "react/prop-types": "off",
    },
  },
];
