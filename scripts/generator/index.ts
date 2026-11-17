import { format, resolveConfig } from "prettier";
import type { Ir } from "./ir.ts";
import { generateModels } from "./models.ts";
import { generateResources } from "./resources.ts";
import { generateCodeSamples } from "./samples.ts";

/** Directories the generator owns outright: anything else in them is stale. */
export const GENERATED_DIRECTORIES = [
  "src/models",
  "src/resources",
  "docs/reference",
];

/**
 * Every generated file, path relative to the repo root → formatted source.
 * The same IR always yields the same map.
 */
export const generate = async (
  ir: Ir,
  repoRoot: string,
): Promise<ReadonlyMap<string, string>> => {
  const sources = new Map([
    ...generateModels(ir),
    ...generateResources(ir),
    ...(await generateCodeSamples(ir)),
  ]);
  const formatted = await Promise.all(
    [...sources].map(async ([path, source]) => {
      const filepath = `${repoRoot}/${path}`;
      const options = (await resolveConfig(filepath)) ?? {};
      return [path, await format(source, { ...options, filepath })] as const;
    }),
  );
  return new Map(formatted);
};
