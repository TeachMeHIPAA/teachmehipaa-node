// Loads the built package through its own `exports` map, as ESM and as CJS,
// to catch a broken dual build before anyone installs it.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const options = { clientId: "cli_check", clientSecret: "tmh_cs_check" };

const esm = await import("teachmehipaa");
assert.equal(typeof esm.default, "function", "ESM default export");
assert.equal(esm.default, esm.TeachMeHipaa, "ESM named export");
assert.equal(typeof new esm.default(options).learners.retrieve, "function");
assert.equal(typeof esm.TeachMeHipaaError, "function");

const cjs = createRequire(import.meta.url)("teachmehipaa");
assert.equal(typeof cjs.TeachMeHipaa, "function", "CJS named export");
assert.equal(cjs.default, cjs.TeachMeHipaa, "CJS default export");
assert.equal(typeof new cjs.TeachMeHipaa(options).learners, "object");

console.log("dist: ESM and CJS entry points load");
