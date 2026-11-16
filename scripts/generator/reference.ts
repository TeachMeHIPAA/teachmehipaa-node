import type { Ir, IrMethod, IrSecurity } from "./ir.ts";
import { resourceSignatures, type ResourceSignatures } from "./resources.ts";

export const REFERENCE_PATH = "docs/reference/resources.md";

const BANNER =
  "<!-- Generated from openapi/sdk-ir.json by `npm run generate`. Edit the generator, not this file. -->";

/**
 * Public methods with no operation of their own, which the IR can't
 * describe, by resource: what to read instead.
 */
const HAND_WRITTEN_METHODS: Readonly<Record<string, string>> = {
  events:
    "Plus `events.tail(params?, options?)`, hand-written over `events.list`: an async iterator over the Event log, oldest first, that tracks its position in `lastEventId` and stops on an `AbortSignal`. See [Tailing the Event log](../guides/pagination.md#tailing-the-event-log).",
};

const code = (text: string): string => `\`${text}\``;

/** A heading's GitHub anchor, for headings made of code and dots. */
const anchor = (heading: string): string =>
  heading.toLowerCase().replace(/[^a-z0-9 _-]/g, "");

const scopes = (security: IrSecurity): string => {
  if (security.kind === "none") {
    return "None (public, no Access token)";
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
      return "Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it";
    case "optional":
      return "`Idempotency-Key` only when you pass `idempotencyKey`";
    case "none":
      return "None";
  }
};

const retries = (method: IrMethod): string =>
  method.retrySafe
    ? "Network errors, 409 `conflict`, 429, 5xx"
    : "Never (unsafe to replay)";

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
    "# Resource reference",
    `${String(resources.length)} resources, ${String(methodCount)} methods, generated from Developer API release ${code(ir.source.release)}. Types live in the [TypeDoc site](https://teachmehipaa.github.io/teachmehipaa-node/); usage lives in the [guides](../README.md).`,
    `Methods return promises (lists return a ${code("PagePromise")} you can ${code("for await")}). Arguments go path parameters, then params, then [request options](../guides/errors.md#request-options). Results carry a non-enumerable ${code("lastResponse")} with ${code("requestId")}, ${code("status")} and ${code("etag")}. Routes are relative to the Environment's base URL (${servers}); ${code("{orgId}")} comes from the client's [Organization binding](../guides/client.md#the-organization-binding).`,
    "## Contents",
    contents.join("\n"),
    "## Scopes",
    `A token holds its API client's Scopes, or the subset you name in ${code("scopes")}. Where a method lists alternatives, one set is enough. See [Scopes](../guides/client.md#scopes).`,
    scopeTable(ir),
    ...resources.map(resourceSection),
  ].join("\n\n");
  return new Map([[REFERENCE_PATH, `${markdown}\n`]]);
};
