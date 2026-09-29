// Lint rules for the whole monorepo (app, shared, web). Run: npm run lint
// Errors fail CI; warnings are things worth a look but not blockers.
import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["**/node_modules/**", "**/dist/**", "**/dist-*/**", "app/android/**", "app/ios/**", "app/.expo/**", "**/*.min.js"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node, __DEV__: "readonly" },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "19" } },
    rules: {
      "react/jsx-uses-vars": "error",     // a component used only in JSX counts as used
      "react/jsx-uses-react": "off",
      "react/jsx-no-undef": "error",      // <Missing /> is an error, not a crash on the phone
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": ["warn", { args: "none", ignoreRestSiblings: true, caughtErrors: "none", varsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
