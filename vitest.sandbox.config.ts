import { defineConfig } from "vitest/config";

// The optional Sandbox smoke test: `npm run test:sandbox`. It calls the real
// Sandbox with TMH_SANDBOX_CLIENT_ID and TMH_SANDBOX_CLIENT_SECRET, skips
// without them, and never runs in CI.
export default defineConfig({
  test: {
    include: ["test/sandbox/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
