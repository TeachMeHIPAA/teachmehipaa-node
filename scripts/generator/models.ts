import type {
  Ir,
  IrEnumType,
  IrField,
  IrObjectType,
  IrType,
  IrUnionType,
} from "./ir.ts";
import {
  BANNER,
  Imports,
  byCodePoint,
  docComment,
  fieldDoc,
  literal,
  modelFileName,
  renderType,
  withNull,
} from "./render.ts";

/** A union member's discriminator property, narrowed to its literal values. */
interface DiscriminatorLiteral {
  readonly property: string;
  readonly values: readonly string[];
}

/**
 * TypeScript only narrows a union on a property whose type is a literal in
 * every member, but the IR types the discriminator as a plain string. So each
 * member of a property-discriminated union gets its value as the type.
 */
const discriminatorLiterals = (
  types: readonly IrType[],
): ReadonlyMap<string, DiscriminatorLiteral> => {
  const literals = new Map<string, DiscriminatorLiteral>();
  types.forEach((type) => {
    if (type.kind !== "union" || type.discriminator.kind !== "property") {
      return;
    }
    const { property, mapping } = type.discriminator;
    Object.entries(mapping).forEach(([value, member]) => {
      const existing = literals.get(member);
      if (existing !== undefined && existing.property !== property) {
        throw new Error(
          `${member} is discriminated by both "${existing.property}" and "${property}"`,
        );
      }
      literals.set(member, {
        property,
        values: [...(existing?.values ?? []), value],
      });
    });
  });
  return literals;
};

const renderField = (
  field: IrField,
  imports: Imports,
  discriminator: DiscriminatorLiteral | undefined,
  mergePatch: boolean,
): string => {
  const type =
    discriminator?.property === field.name
      ? discriminator.values.map(literal).join(" | ")
      : withNull(renderType(field.type, imports), field.nullable);
  const optional = field.required ? "" : "?";
  // In a merge patch `undefined` means "leave unchanged" (grilling Q28), so
  // callers with exactOptionalPropertyTypes may pass it explicitly.
  const unset = mergePatch && !field.required ? " | undefined" : "";
  return `${fieldDoc(field.description, field.type)}readonly ${field.name}${optional}: ${type}${unset};`;
};

const renderObject = (
  type: IrObjectType,
  imports: Imports,
  discriminator: DiscriminatorLiteral | undefined,
): string => {
  const declared = type.fields.some(
    (field) => field.name === discriminator?.property,
  );
  const fields = [
    ...type.fields.map((field) =>
      renderField(field, imports, discriminator, type.mergePatch),
    ),
    ...(discriminator === undefined || declared
      ? []
      : [
          `readonly ${discriminator.property}: ${discriminator.values.map(literal).join(" | ")};`,
        ]),
  ];
  const notes = type.mergePatch
    ? "Sent as a JSON merge patch: omit a field (or leave it `undefined`) to leave it unchanged; `null` clears a nullable field."
    : null;
  return `${docComment([type.description, notes])}export interface ${type.name} {\n${fields.join("\n")}\n}\n`;
};

const renderEnum = (type: IrEnumType): string => {
  const values = type.values.map((value) => `| ${literal(value)}`).join("\n");
  return `${docComment([
    type.description,
    "Known values are listed; the API may add more at any time, so handle values you don't recognize.",
  ])}export type ${type.name} =\n${values}\n| (string & {});\n`;
};

const unionMembers = (type: IrUnionType): readonly string[] => {
  const { discriminator } = type;
  const members = Object.values(discriminator.mapping);
  const fallback =
    discriminator.kind === "presence" && discriminator.fallback !== null
      ? [discriminator.fallback]
      : [];
  return [...new Set([...members, ...fallback])];
};

const renderUnion = (type: IrUnionType, imports: Imports): string => {
  const note =
    type.discriminator.kind === "property"
      ? `Tell the variants apart by \`${type.discriminator.property}\`. New variants may be added; handle values you don't recognize.`
      : null;
  const members = unionMembers(type)
    .map((member) => `| ${imports.model(member)}`)
    .join("\n");
  return `${docComment([type.description, note])}export type ${type.name} =\n${members};\n`;
};

const modelSource = (
  type: IrType,
  literals: ReadonlyMap<string, DiscriminatorLiteral>,
): string => {
  const imports = new Imports();
  const body =
    type.kind === "object"
      ? renderObject(type, imports, literals.get(type.name))
      : type.kind === "enum"
        ? renderEnum(type)
        : renderUnion(type, imports);
  const importLines = imports.render(
    (name) => `./${modelFileName(name)}.js`,
    "../core",
  );
  return `${BANNER}\n${importLines}\n\n${body}`;
};

/** One file per IR type in `src/models/`, plus an index re-exporting them. */
export const generateModels = (ir: Ir): ReadonlyMap<string, string> => {
  const literals = discriminatorLiterals(ir.types);
  const files = new Map<string, string>();
  const sorted = [...ir.types].sort((a, b) => byCodePoint(a.name, b.name));
  sorted.forEach((type) => {
    const path = `src/models/${modelFileName(type.name)}.ts`;
    if (files.has(path)) {
      throw new Error(`Two IR types map to ${path}`);
    }
    files.set(path, modelSource(type, literals));
  });
  const exports = sorted
    .map(
      (type) =>
        `export type { ${type.name} } from "./${modelFileName(type.name)}.js";`,
    )
    .join("\n");
  files.set("src/models/index.ts", `${BANNER}\n${exports}\n`);
  return files;
};
