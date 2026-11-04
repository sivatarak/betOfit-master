const expoConfig = require("eslint-config-expo/flat");
const { defineConfig } = require("eslint/config");
const globals = require("globals");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [".expo/**", "android/**", "dist/**", "node_modules/**"],
  },
  {
    files: [
      "App.js",
      "eslint.config.js",
      "metro.config.js",
      "scripts/**/*.{js,ts,tsx}",
      "withTrimVectorIcons.js",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
