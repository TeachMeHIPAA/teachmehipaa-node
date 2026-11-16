import type { Ir, IrMethod, IrSecurity } from "./ir.ts";
import { resourceSignatures, type ResourceSignatures } from "./resources.ts";

export const REFERENCE_PATH = "docs/reference/resources.md";

const BANNER =
  "<!-- Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`. -->";

/**
 * Public methods with no operation of their own, which the IR can't
 * describe, by resource: what to read instead.
 */
const HAND_WRITTEN_METHODS: Readonly<Record<string, string>> = {
  events:
    "`events.tail(params?, options?)` is hand-written on top of `events.list`: it iterates the Event log oldest first and keeps its position in `lastEventId`. See [Pagination and the Event log](../guides/pagination-and-events.md#tailing-the-event-log).",
};

const code = (text: string): string => `\`${text}\``;

/** A heading's GitHub anchor, for headings made of code and dots. */
const anchor = (heading: string): string =>
  heading.toLowerCase().replace(/[^a-z0-9 _-]/g, "");

const scopes = (security: IrSecurity): string => {
  if (security.kind === "none") {
    return "None: a public method, sent without an Access token";
  }
  const sets = security.anyOf.map((set) =>
    set.length === 0 ? null : set.map(code).join(" and "),
  );
  return sets.includes(null)
    ? "Any Access token"
    : sets.filter((set): set is string => set !== null).join(" or ");
};

const httpRoute = (method: IrMethod): string => {
  const { template, customVerb } = method.path;
  return code(
    `${method.httpMethod} ${template}${customVerb === null ? "" : `:${customVerb}`}`,
  );
};

const idempotency = (method: IrMethod): string => {
  switch (method.idempotencyKey) {
    case "required":
      return "Sends a generated `Idempotency-Key`, the same on every retry; pass `idempotencyKey` to set your own";
    case "optional":
      return "Sends an `Idempotency-Key` only when you pass `idempotencyKey`";
    case "none":
      return "None";
  }
};

const retries = (method: IrMethod): string =>
  method.retrySafe
    ? "Retried on network errors, 409 `conflict`, 429 and 5xx"
    : "Never retried: replaying it isn't safe";

/** Table cells can't hold a raw pipe. */
const cell = (text: string): string => text.replaceAll("|", "\\|");

const methodSection = (
  resource: ResourceSignatures,
  { method, signature }: ResourceSignatures["methods"][number],
): string => {
  const name = [...resource.path, method.name].join(".");
  const rows: readonly (readonly [string, string])[] = [
    ["HTTP", httpRoute(method)],
    ["Scopes", scopes(method.security)],
    ["Returns", code(signature.returnType)],
    ["Retries", retries(method)],
    ["Idempotency", idempotency(method)],
    ...(signature.note === null ? [] : ([["Notes", signature.note]] as const)),
  ];
  return [
    `### ${code(name)}`,
    method.summary ?? "",
    method.description ?? "",
    [
      "```ts",
      `client.${name}(`,
      ...signature.parameters.map((parameter) => `  ${parameter},`),
      `): ${signature.returnType}`,
      "```",
    ].join("\n"),
    [
      "| | |",
      "| --- | --- |",
      ...rows.map(([label, value]) => `| ${label} | ${cell(value)} |`),
    ].join("\n"),
  ]
    .filter((block) => block !== "")
    .join("\n\n");
};

const resourceSection = (resource: ResourceSignatures): string => {
  const key = resource.path.join(".");
  const handWritten = HAND_WRITTEN_METHODS[key];
  return [
    `## ${code(key)}`,
    ...(handWritten === undefined ? [] : [handWritten]),
    ...resource.methods.map((entry) => methodSection(resource, entry)),
  ].join("\n\n");
};

const scopeTable = (ir: Ir): string =>
  [
    "| Scope | Allows |",
    "| --- | --- |",
    ...ir.auth.scopes.map(
      (scope) => `| ${code(scope.name)} | ${cell(scope.description ?? "")} |`,
    ),
  ].join("\n");

/**
 * `docs/reference/resources.md`: every resource and method of the client,
 * with its signature, HTTP route, Scopes, retry and idempotency behavior.
 */
export const generateReference = (ir: Ir): ReadonlyMap<string, string> => {
  const resources = resourceSignatures(ir);
  const methodCount = resources.reduce(
    (count, resource) => count + resource.methods.length,
    0,
  );
  const servers = ir.servers
    .map(
      (server) =>
        `${server.environment === "live" ? "Live" : "Sandbox"} is ${code(server.url)}`,
    )
    .join("; ");
  const contents = resources.map((resource) => {
    const key = code(resource.path.join("."));
    return `- [${key}](#${anchor(key)}): ${resource.methods
      .map((method) => {
        const name = code([...resource.path, method.method.name].join("."));
        return `[${code(method.method.name)}](#${anchor(name)})`;
      })
      .join(", ")}`;
  });
  const markdown = [
    BANNER,
    "# API resources",
    `Every resource and method of the ${code("TeachMeHipaa")} client: ${String(resources.length)} resources and ${String(methodCount)} methods, generated from the Developer API release ${code(ir.source.release)}. For the full types, see the [API reference](https://teachmehipaa.github.io/teachmehipaa-node/); for how the pieces fit together, the [guides](../README.md).`,
    `Every method is async, takes its parameters first and [request options](../guides/errors-and-retries.md#request-options) last, and resolves objects with a non-enumerable ${code("lastResponse")}. Paths are relative to the Environment's base URL (${servers}). The client fills in ${code("{orgId}")} from its [Organization binding](../guides/authentication.md#the-organization-binding).`,
    "## Contents",
    contents.join("\n"),
    "## Scopes",
    `An Access token carries the Scopes its API client holds, or fewer if you pass ${code("scopes")}. A method that lists several sets needs any one of them. See [Authentication](../guides/authentication.md#scopes).`,
    scopeTable(ir),
    ...resources.map(resourceSection),
  ].join("\n\n");
  return new Map([[REFERENCE_PATH, `${markdown}\n`]]);
};
