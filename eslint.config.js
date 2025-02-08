import babelParser from "@babel/eslint-parser";
import pluginImport from "eslint-plugin-import";
import pluginPrettier from "eslint-plugin-prettier";
import pluginReact from "eslint-plugin-react";
import globals from "globals";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    ignores: [
      ".vscode/**",
      "dist/**",
      "dist_electron/**",
      "node_modules/**",
      ".github/**",
    ],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      ecmaVersion: "latest",
      sourceType: "module",
      parser: babelParser, // Use Babel parser for JSX support
      parserOptions: {
        requireConfigFile: false, // Allow parsing without a Babel config
        babelOptions: {
          presets: ["@babel/preset-react"], // Ensure React preset is used
        },
      },
    },
    plugins: {
      import: pluginImport,
      prettier: pluginPrettier,
      react: pluginReact,
    },
    rules: {
      "import/no-commonjs": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "prefer-const": "error",
      "import/order": [
        "error",
        { alphabetize: { order: "asc", caseInsensitive: true } },
      ],
      "prettier/prettier": "warn",
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
    },
    settings: {
      react: { version: "detect" },
    },
  },
  {
    // Override for CommonJS files like preload.cjs
    files: ["**/preload.cjs"],
    languageOptions: {
      sourceType: "script", // Set to "script" for CommonJS files
    },
    rules: {
      "import/no-commonjs": "off", // Disable "no-commonjs" for preload.cjs
      "no-undef": "off", // Allow undefined variables in CommonJS
      "import/no-import-module-exports": "off", // Disable this rule for CommonJS files
    },
  },
];
