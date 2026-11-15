// Naming rules. The IR already gives camelCase resource and method names and
// PascalCase type names; these only derive the TypeScript-specific names
// (files, classes, params types) from them.

export const pascal = (name: string): string =>
  name.charAt(0).toUpperCase() + name.slice(1);

export const kebab = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();

/**
 * English singular of a camelCase resource segment, for type names such as
 * `LearnerCreateParams`. The IR has no singular names, so this covers the
 * plural forms resource names use.
 */
export const singular = (name: string): string => {
  if (name.endsWith("ies")) {
    return `${name.slice(0, -3)}y`;
  }
  if (name.endsWith("sses")) {
    return name.slice(0, -2);
  }
  if (name.endsWith("s") && !name.endsWith("ss")) {
    return name.slice(0, -1);
  }
  return name;
};

/** `["partners", "organizations"]` → `PartnerOrganizations`. */
export const resourceClassName = (path: readonly string[]): string =>
  path
    .map((segment, index) =>
      pascal(index === path.length - 1 ? segment : singular(segment)),
    )
    .join("");

/** `["partners", "organizations"]`, `list` → `PartnerOrganizationListParams`. */
export const paramsTypeName = (
  path: readonly string[],
  method: string,
): string =>
  `${path.map((segment) => pascal(singular(segment))).join("")}${pascal(method)}Params`;

export const resourceFileName = (path: readonly string[]): string =>
  path.map(kebab).join("-");

// Words that can't be a parameter or binding name.
const RESERVED = new Set([
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

export const assertBindingName = (name: string, where: string): void => {
  if (RESERVED.has(name) || !/^[A-Za-z_$][\w$]*$/.test(name)) {
    throw new Error(`${where}: "${name}" can't be a TypeScript parameter name`);
  }
};
