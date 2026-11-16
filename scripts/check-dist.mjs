// Loads the built package through its own `exports` map, as ESM and as CJS,
// to catch a broken dual build before anyone installs it.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { execPath } from "node:process";

const options = { clientId: "cli_check", clientSecret: "tmh_cs_check" };

const esm = await import("@teachmehipaa/node");
assert.equal(typeof esm.default, "function", "ESM default export");
assert.equal(esm.default, esm.TeachMeHipaa, "ESM named export");
assert.equal(typeof new esm.default(options).learners.retrieve, "function");
assert.equal(typeof esm.TeachMeHipaaError, "function");
assert.equal(typeof esm.webhooks.constructEvent, "function", "ESM webhooks");

const cjs = createRequire(import.meta.url)("@teachmehipaa/node");
assert.equal(typeof cjs.TeachMeHipaa, "function", "CJS named export");
assert.equal(cjs.default, cjs.TeachMeHipaa, "CJS default export");
assert.equal(typeof new cjs.TeachMeHipaa(options).learners, "object");
assert.equal(cjs.TeachMeHipaa.webhooks, cjs.webhooks, "CJS webhooks");

// The docs' plain JavaScript samples (```js sample=<id>) are CommonJS that
// the TypeScript harness can't check, so each runs here against the build,
// with a `fetch` that answers every request with a Course.
const docs = [
  "README.md",
  ...readdirSync("docs/guides").map((name) => `docs/guides/${name}`),
];
const FAKE_FETCH = `globalThis.fetch = async () => Response.json({
  courseId: "hipaa-2026", title: "HIPAA Training 2026",
  courseVersion: "2026.1", passingThreshold: 80,
});`;
const jsSamples = docs.flatMap((file) =>
  [
    ...readFileSync(file, "utf8").matchAll(
      /^```js\b[^\n]*\bsample=([\w-]+)[^\n]*\n([\s\S]*?)^```$/gm,
    ),
  ].map(([, id, code]) => ({ file, id, code })),
);
assert.ok(jsSamples.length > 0, "no js samples found in the docs");
for (const { file, id, code } of jsSamples) {
  const output = execFileSync(
    execPath,
    ["--input-type=commonjs", "-e", `${FAKE_FETCH}\n${code}`],
    { encoding: "utf8" },
  );
  assert.notEqual(output.trim(), "", `${file} sample=${id} printed nothing`);
}

console.log(
  `dist: ESM and CJS entry points load; ${String(jsSamples.length)} js doc sample(s) ran`,
);
