// Regenerates the resource and model layer from the vendored IR:
// `npm run generate`. Reads only openapi/sdk-ir.json (ADR-0001).
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GENERATED_DIRECTORIES, generate } from "./generator/index.ts";
import { validateIr } from "./generator/validate.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(join(repoRoot, path), "utf8")) as unknown;

const ir = validateIr(
  await readJson("openapi/sdk-ir.json"),
  (await readJson("openapi/sdk-ir.schema.json")) as object,
);
const files = await generate(ir, repoRoot);

const stale = (
  await Promise.all(
    GENERATED_DIRECTORIES.map(async (directory) =>
      (await readdir(join(repoRoot, directory)).catch(() => [])).map(
        (name) => `${directory}/${name}`,
      ),
    ),
  )
)
  .flat()
  .filter((path) => !files.has(path));
await Promise.all(stale.map((path) => rm(join(repoRoot, path))));
await Promise.all(
  [...files].map(async ([path, source]) => {
    await mkdir(dirname(join(repoRoot, path)), { recursive: true });
    await writeFile(join(repoRoot, path), source);
  }),
);
console.log(
  `Generated ${String(files.size)} files from IR ${ir.source.release}; removed ${String(stale.length)} stale.`,
);
