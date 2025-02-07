import pluginJs from "@eslint/js";
import pluginImport from "eslint-plugin-import";
import pluginPrettier from "eslint-plugin-prettier";
import pluginReact from "eslint-plugin-react";
import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    ignores: [".vscode/**", "dist/**", "dist_electron/**", "node_modules/**"],
  },
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      sourceType: "module", // Enforce ESM
    },
    rules: {
      "import/no-commonjs": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "prefer-const": "error",
      "import/order": [
        "error",
        { alphabetize: { order: "asc", caseInsensitive: true } },
      ],
    },
  },
  pluginJs.configs.recommended,
  {
    ...pluginReact.configs.flat.recommended,
    settings: {
      react: {
        version: "detect", // Automatically detect the react version
      },
    },
  },
  {
    plugins: {
      import: pluginImport,
      prettier: pluginPrettier,
    },
    rules: {
      "prettier/prettier": "warn",
    },
  },
];
