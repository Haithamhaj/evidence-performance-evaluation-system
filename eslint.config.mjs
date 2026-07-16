import babelParser from "@babel/eslint-parser";

const commonRules = {
  "no-undef": "error",
  "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
};
const commonLanguageOptions = {
  ecmaVersion: "latest",
  sourceType: "module",
};

export default [
  {
    ignores: ["**/.next/**", "**/.turbo/**", "**/coverage/**", "**/dist/**", "**/node_modules/**"],
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ...commonLanguageOptions,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: commonRules,
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ...commonLanguageOptions,
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          parserOpts: { plugins: ["jsx"] },
          plugins: [["@babel/plugin-syntax-decorators", { version: "2023-11" }]],
          presets: ["@babel/preset-typescript"],
        },
      },
    },
    rules: { ...commonRules, "no-undef": "off" },
  },
];
