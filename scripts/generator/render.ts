import type { TypeRef } from "./ir.ts";
import { kebab } from "./naming.ts";

export const BANNER =
  "// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.";

/** A JSDoc block from paragraphs; empty paragraphs are dropped. */
export const docComment = (
  paragraphs: readonly (string | null | undefined)[],
): string => {
  const kept = paragraphs.filter(
    (paragraph): paragraph is string =>
      paragraph !== null && paragraph !== undefined && paragraph.trim() !== "",
  );
  if (kept.length === 0) {
    return "";
  }
  const text = kept.join("\n\n").replaceAll("*/", "*\\/");
  if (!text.includes("\n")) {
    return `/** ${text.trim()} */\n`;
  }
  const lines = text
    .split("\n")
    .map((line) => (line.trim() === "" ? " *" : ` * ${line.trimEnd()}`));
  return `/**\n${lines.join("\n")}\n */\n`;
};

/** Code-point order, so output doesn't depend on the machine's locale. */
export const byCodePoint = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/** The names one file references, so it can import them. */
export class Imports {
  readonly #models = new Set<string>();
  readonly #coreTypes = new Map<string, Set<string>>();
  readonly #coreValues = new Map<string, Set<string>>();

  model(name: string): string {
    this.#models.add(name);
    return name;
  }

  core(module: string, name: string): string {
    return Imports.#add(this.#coreTypes, module, name);
  }

  coreValue(module: string, name: string): string {
    return Imports.#add(this.#coreValues, module, name);
  }

  static #add(
    names: Map<string, Set<string>>,
    module: string,
    name: string,
  ): string {
    names.set(module, (names.get(module) ?? new Set<string>()).add(name));
    return name;
  }

  render(modelsPath: (name: string) => string, coreDir: string): string {
    const sorted = (names: Iterable<string>) => [...names].sort(byCodePoint);
    const modules = sorted(
      new Set([...this.#coreTypes.keys(), ...this.#coreValues.keys()]),
    );
    const core = modules.map((module) => {
      const values = sorted(this.#coreValues.get(module) ?? []);
      const types = sorted(this.#coreTypes.get(module) ?? []);
      const from = `from "${coreDir}/${module}.js";`;
      return values.length === 0
        ? `import type { ${types.join(", ")} } ${from}`
        : `import { ${[...values, ...types.map((name) => `type ${name}`)].join(", ")} } ${from}`;
    });
    const models = sorted(this.#models).map(
      (name) => `import type { ${name} } from "${modelsPath(name)}";`,
    );
    return [...core, ...models].join("\n");
  }
}

export const modelFileName = (typeName: string): string => kebab(typeName);

const needsParens = (rendered: string): boolean => /[\s|&]/.test(rendered);

const renderPrimitive = (
  type: Extract<TypeRef, { kind: "primitive" }>["type"],
  imports: Imports,
): string => {
  switch (type) {
    // Date-times stay strings: parsing them would change the value a caller
    // sees from what the API sent.
    case "string":
    case "dateTime":
      return "string";
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "json":
      return "unknown";
    case "binary":
      return imports.core("uploads", "Uploadable");
  }
};

/** The TypeScript type for an IR type reference. */
export const renderType = (type: TypeRef, imports: Imports): string => {
  switch (type.kind) {
    case "primitive":
      return renderPrimitive(type.type, imports);
    case "ref":
      return imports.model(type.name);
    case "array": {
      const items = renderType(type.items, imports);
      return `readonly ${needsParens(items) ? `(${items})` : items}[]`;
    }
    case "map":
      return `Readonly<Record<string, ${renderType(type.values, imports)}>>`;
  }
};

/** Adds `| null`, except to `unknown`, which already includes it. */
export const withNull = (rendered: string, nullable: boolean): string =>
  nullable && rendered !== "unknown" ? `${rendered} | null` : rendered;

export const isDateTime = (type: TypeRef): boolean =>
  type.kind === "primitive" && type.type === "dateTime";

/** Field docs; date-times say they are ISO 8601 strings. */
export const fieldDoc = (description: string | null, type: TypeRef): string => {
  if (!isDateTime(type) || description?.includes("ISO 8601") === true) {
    return docComment([description]);
  }
  return docComment([description, "An ISO 8601 date-time string."]);
};

export const literal = (value: string | number | boolean | null): string =>
  JSON.stringify(value);
