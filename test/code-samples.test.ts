// docs/reference/code-samples.json feeds the "Node" tab of the
// TeachMeHIPAA API reference, one program per operation. Each one must
// compile against the library as it is, so a renamed or missing method
// fails here before the reference shows it.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROOT, typeErrors, type Sample } from "./readme/harness.js";

const FILE = "docs/reference/code-samples.json";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(`${ROOT}${path}`, "utf8"));

const { language, release, samples } = readJson(FILE) as {
  readonly language: string;
  readonly release: string;
  readonly samples: Readonly<Record<string, string>>;
};

/** Each operationId's first method in the IR, as `resource.method`. */
const expectedMethods = (): ReadonlyMap<string, string> => {
  const ir = readJson("openapi/sdk-ir.json") as {
    readonly resources: readonly {
      readonly path: readonly string[];
      readonly methods: readonly { name: string; operationId: string }[];
    }[];
  };
  return ir.resources
    .flatMap((resource) =>
      resource.methods.map((method): [string, string] => [
        method.operationId,
        [...resource.path, method.name].join("."),
      ]),
    )
    .reduce(
      (methods, [operationId, name]) =>
        methods.has(operationId)
          ? methods
          : new Map([...methods, [operationId, name]]),
      new Map<string, string>(),
    );
};

describe("code-samples.json", () => {
  it("names this SDK and the IR release it was generated from", () => {
    expect(language).toBe("node");
    expect(release).toBe(readFileSync(`${ROOT}OPENAPI_VERSION`, "utf8").trim());
  });

  it("has one sample per IR operationId, calling its first method", () => {
    const methods = expectedMethods();

    expect(Object.keys(samples).sort()).toEqual([...methods.keys()].sort());
    methods.forEach((method, operationId) => {
      expect(samples[operationId]).toContain(`client.${method}(`);
    });
  });

  it("creates its own client in every sample, from the environment", () => {
    Object.values(samples).forEach((code) => {
      expect(code).toContain(`import TeachMeHipaa from "@teachmehipaa/node";`);
      expect(code).toMatch(/const client = new TeachMeHipaa\(/);
      expect(code).toContain(`environment: "sandbox"`);
    });
  });

  it("type-checks every sample", () => {
    const sources: readonly Sample[] = Object.entries(samples).map(
      ([id, code]) => ({ file: FILE, id, code }),
    );
    expect(typeErrors(sources)).toEqual([]);
  }, 60_000);
});
