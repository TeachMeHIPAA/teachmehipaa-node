import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/",
      "coverage/",
      "node_modules/",
      "site/",
      "test/readme/.generated/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.js", "scripts/*.mjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // The examples import "@teachmehipaa/node" by name, which only their own
    // tsconfig maps to the source.
    files: ["examples/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./tsconfig.examples.json",
      },
    },
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      // ADR-0007: the library never writes to the console; logging goes
      // only through the caller's opt-in logger.
      "no-console": "error",
    },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { console: "readonly" } },
  },
  prettier,
);
