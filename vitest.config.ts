import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Each has its own config and script: `test:contract`, `test:sandbox`.
    exclude: ["test/contract/**", "test/sandbox/**", "**/node_modules/**"],
    pool: "threads",
    poolOptions: { threads: { maxThreads: 4 } },
  },
});
