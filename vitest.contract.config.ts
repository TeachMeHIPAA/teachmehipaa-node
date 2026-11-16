import { defineConfig } from "vitest/config";

// The Prism contract suite: `npm run test:contract`. It starts its own Prism
// mock, so it stays out of the default, instant `npm test`.
export default defineConfig({
  test: {
    include: ["test/contract/**/*.test.ts"],
    globalSetup: ["test/contract/prism.ts"],
    pool: "threads",
    poolOptions: { threads: { maxThreads: 4 } },
    testTimeout: 15_000,
  },
});
