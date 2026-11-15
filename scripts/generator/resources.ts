import type {
  BodyConstraint,
  Ir,
  IrField,
  IrMethod,
  IrObjectType,
  IrParam,
  IrResource,
  IrType,
  TypeRef,
} from "./ir.ts";
import {
  assertBindingName,
  paramsTypeName,
  resourceClassName,
  resourceFileName,
} from "./naming.ts";
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

// The requester prefixes org-scoped paths with the client's Organization
// (ADR-0003), so generated paths start after it.
const ORGANIZATION_PREFIX = "/organizations/{orgId}";

const JSON_CONTENT_TYPE = "application/json";

/**
 * Resources with hand-written methods, by IR path. The generator names their
 * class `<Name>Base`; `src/extensions/<file>.ts` extends it under the plain
 * name, and the client exposes that subclass.
 */
export const EXTENDED_RESOURCES: ReadonlySet<string> = new Set(["events"]);

/**
 * The type of `Operation.response` for operations that have one, by
 * operationId, from `src/core/operations.ts`. The spec leaves `response`
 * untyped (research `api-sdk-surface.md` §8).
 */
export const OPERATION_RESPONSES: Readonly<Record<string, string>> = {
  redriveWebhookSubscription: "WebhookDeliveryResult",
  testWebhookSubscription: "WebhookDeliveryResult",
};

const isExtended = (path: readonly string[]): boolean =>
  EXTENDED_RESOURCES.has(path.join("."));

/** The class the client exposes, as imported from inside `src/resources/`. */
const exposedClass = (
  path: readonly string[],
): { readonly className: string; readonly specifier: string } => ({
  className: resourceClassName(path),
  specifier: `${isExtended(path) ? "../extensions" : "."}/${resourceFileName(path)}.js`,
});

/** The request-body constraints under one property path, as a tree. */
interface ConstraintNode {
  readonly fixed?: { readonly value: string | number | boolean | null };
  readonly variant?: string;
  readonly children: Map<string, ConstraintNode>;
}

const constraintTree = (
  constraints: readonly BodyConstraint[],
): ConstraintNode => {
  const root: ConstraintNode = { children: new Map() };
  constraints.forEach((constraint) => {
    const parent = constraint.path
      .slice(0, -1)
      .reduce<ConstraintNode>((node, key) => {
        const child = node.children.get(key) ?? { children: new Map() };
        node.children.set(key, child);
        return child;
      }, root);
    const key = constraint.path.at(-1) ?? "";
    parent.children.set(key, {
      children: new Map(),
      ...(constraint.kind === "const"
        ? { fixed: { value: constraint.value } }
        : { variant: constraint.requiredProperty }),
    });
  });
  return root;
};

const hasFixedValue = (node: ConstraintNode): boolean =>
  node.fixed !== undefined || [...node.children.values()].some(hasFixedValue);

class Context {
  readonly #types: ReadonlyMap<string, IrType>;

  constructor(ir: Ir) {
    this.#types = new Map(ir.types.map((type) => [type.name, type]));
  }

  objectType(ref: TypeRef, where: string): IrObjectType {
    const type = ref.kind === "ref" ? this.#types.get(ref.name) : undefined;
    if (type?.kind !== "object") {
      throw new Error(`${where}: expected a reference to an object type`);
    }
    return type;
  }

  /** The union member a `variant` constraint selects. */
  variantMember(ref: TypeRef, requiredProperty: string, where: string): string {
    const type = ref.kind === "ref" ? this.#types.get(ref.name) : undefined;
    const member =
      type?.kind === "union" && type.discriminator.kind === "presence"
        ? type.discriminator.mapping[requiredProperty]
        : undefined;
    if (member === undefined) {
      throw new Error(
        `${where}: no presence-union member requires "${requiredProperty}"`,
      );
    }
    return member;
  }
}

/** An object type with constrained fields removed or narrowed. */
interface Constrained {
  readonly omitted: readonly string[];
  readonly members: readonly string[];
  /** Every field was fixed by the method, so callers pass nothing. */
  readonly empty: boolean;
}

const constrainedMember = (field: IrField, type: string): string =>
  `${fieldDoc(field.description, field.type)}readonly ${field.name}${field.required ? "" : "?"}: ${withNull(type, field.nullable)};`;

const constrain = (
  context: Context,
  object: IrObjectType,
  node: ConstraintNode,
  imports: Imports,
  where: string,
): Constrained => {
  const results = [...node.children.entries()].map(([key, child]) => {
    const field = object.fields.find((candidate) => candidate.name === key);
    if (field === undefined) {
      throw new Error(`${where}: ${object.name} has no field "${key}"`);
    }
    if (child.fixed !== undefined) {
      return { key, member: null };
    }
    if (child.variant !== undefined) {
      const member = context.variantMember(field.type, child.variant, where);
      return { key, member: constrainedMember(field, imports.model(member)) };
    }
    const inner = context.objectType(field.type, `${where}.${key}`);
    const rendered = renderConstrained(
      inner.name,
      constrain(context, inner, child, imports, `${where}.${key}`),
      imports,
    );
    return {
      key,
      member: rendered === null ? null : constrainedMember(field, rendered),
    };
  });
  const members = results.flatMap(({ member }) =>
    member === null ? [] : [member],
  );
  return {
    omitted: results.map(({ key }) => key),
    members,
    empty: members.length === 0 && results.length === object.fields.length,
  };
};

const renderConstrained = (
  name: string,
  constrained: Constrained,
  imports: Imports,
): string | null => {
  if (constrained.empty) {
    return null;
  }
  imports.model(name);
  const base =
    constrained.omitted.length === 0
      ? name
      : `Omit<${name}, ${constrained.omitted.map(literal).join(" | ")}>`;
  return constrained.members.length === 0
    ? base
    : `${base} & { ${constrained.members.join(" ")} }`;
};

/**
 * The body expression with the method's fixed values written in; with no
 * caller-supplied expression, the body is the fixed values alone.
 */
const withFixedValues = (
  expression: string | null,
  node: ConstraintNode,
  // Only the top-level body is known to be present.
  access = ".",
): string => {
  const assignments = [...node.children.entries()]
    .filter(([, child]) => hasFixedValue(child))
    .map(([key, child]) =>
      child.fixed === undefined
        ? `${key}: ${withFixedValues(expression === null ? null : `${expression}${access}${key}`, child, "?.")}`
        : `${key}: ${literal(child.fixed.value)}`,
    );
  if (expression === null) {
    return `{ ${assignments.join(", ")} }`;
  }
  return assignments.length === 0
    ? expression
    : `{ ...${expression}, ${assignments.join(", ")} }`;
};

interface MethodSource {
  readonly params: string;
  readonly method: string;
  readonly exports: readonly string[];
}

const paramField = (param: IrParam, imports: Imports): string =>
  `${fieldDoc(param.description, param.type)}readonly ${param.name}${param.required ? "" : "?"}: ${renderType(param.type, imports)};`;

const requestPath = (method: IrMethod, where: string): string => {
  const { template, customVerb } = method.path;
  if (method.orgScoped && !template.startsWith(`${ORGANIZATION_PREFIX}/`)) {
    throw new Error(
      `${where}: org-scoped path ${template} lacks ${ORGANIZATION_PREFIX}`,
    );
  }
  const relative = method.orgScoped
    ? template.slice(ORGANIZATION_PREFIX.length)
    : template;
  const placeholders = [...relative.matchAll(/\{(\w+)\}/g)].map(
    (match) => match[1],
  );
  const declared = method.pathParams.map((param) => param.name);
  if (placeholders.join() !== declared.join()) {
    throw new Error(
      `${where}: path params [${declared.join()}] don't match ${relative}`,
    );
  }
  return customVerb === null ? relative : `${relative}:${customVerb}`;
};

const methodSource = (
  context: Context,
  resource: IrResource,
  method: IrMethod,
  imports: Imports,
): MethodSource => {
  const where = `${resource.path.join(".")}.${method.name}`;
  if (method.headerParams.length > 0) {
    throw new Error(`${where}: header parameters aren't supported yet`);
  }
  [...method.pathParams, ...method.queryParams].forEach((param) => {
    assertBindingName(param.name, where);
    if (["params", "options", "body"].includes(param.name)) {
      throw new Error(
        `${where}: "${param.name}" clashes with a generated name`,
      );
    }
  });
  const body = method.requestBody;
  const bodyObject =
    body === null ? null : context.objectType(body.type, `${where} body`);
  const clash = method.queryParams.find((param) =>
    bodyObject?.fields.some((field) => field.name === param.name),
  );
  if (clash !== undefined) {
    throw new Error(
      `${where}: "${clash.name}" is both a query and a body field`,
    );
  }

  // The params type: query parameters plus the body's fields, minus what the
  // method fixes itself.
  const typeName = paramsTypeName(resource.path, method.name);
  const queryFields = method.queryParams.map((param) =>
    paramField(param, imports),
  );
  const constraints = constraintTree(body?.constraints ?? []);
  const constrained =
    bodyObject === null
      ? null
      : constrain(context, bodyObject, constraints, imports, where);
  const hasParams =
    queryFields.length > 0 || (constrained !== null && !constrained.empty);
  const paramsRequired =
    method.queryParams.some((param) => param.required) ||
    (body?.required === true && constrained?.empty === false);
  const paramsDoc = docComment([`Parameters for \`${where}\`.`]);
  const params = ((): string => {
    if (!hasParams) {
      return "";
    }
    if (bodyObject === null || constrained === null || constrained.empty) {
      return `${paramsDoc}export interface ${typeName} {\n${queryFields.join("\n")}\n}\n`;
    }
    imports.model(bodyObject.name);
    const base =
      constrained.omitted.length === 0
        ? bodyObject.name
        : `Omit<${bodyObject.name}, ${constrained.omitted.map(literal).join(" | ")}>`;
    const members = [...queryFields, ...constrained.members];
    return members.length === 0
      ? `${paramsDoc}export type ${typeName} = ${base};\n`
      : `${paramsDoc}export interface ${typeName} extends ${base} {\n${members.join("\n")}\n}\n`;
  })();

  const paramsRef = paramsRequired ? "params." : "params?.";
  const destructure =
    bodyObject !== null && method.queryParams.length > 0 && hasParams;
  const bodyExpression = ((): string | null => {
    if (body === null) {
      return null;
    }
    const supplied = !hasParams ? null : destructure ? "body" : "params";
    return withFixedValues(supplied, constraints);
  })();
  const query =
    method.queryParams.length === 0
      ? null
      : `{ ${method.queryParams
          .map((param) =>
            destructure
              ? param.name
              : `${param.name}: ${paramsRef}${param.name}`,
          )
          .join(", ")} }`;

  // The Organization is resolved from the Access token, which a public
  // method never has.
  if (method.orgScoped && method.security.kind === "none") {
    throw new Error(`${where}: an org-scoped method needs bearer security`);
  }
  const response = method.response;
  const conditionalWrite = method.ifMatch !== "none";
  const conditionalRead = method.ifNoneMatch !== "none";
  if (conditionalRead && response.kind !== "model") {
    throw new Error(`${where}: If-None-Match needs a model response`);
  }
  const requestOptions = imports.core(
    "request-options",
    conditionalWrite
      ? "ConditionalWriteOptions"
      : conditionalRead
        ? "ConditionalReadOptions"
        : response.kind === "binary"
          ? "DownloadOptions"
          : "RequestOptions",
  );
  /** The parameter list, with `options` required or optional. */
  const signatureWith = (options: string, optionsRequired = false): string =>
    [
      ...method.pathParams.map(
        (param) => `${param.name}: ${renderType(param.type, imports)}`,
      ),
      ...(hasParams
        ? [
            paramsRequired
              ? `params: ${typeName}`
              : optionsRequired
                ? `params: ${typeName} | undefined`
                : `params?: ${typeName}`,
          ]
        : []),
      `options${optionsRequired ? "" : "?"}: ${options}`,
    ].join(", ");

  const spec = [
    `method: ${literal(method.httpMethod)}`,
    `path: ${literal(requestPath(method, where))}`,
    ...(method.pathParams.length === 0
      ? []
      : [
          `pathParams: { ${method.pathParams
            .map((param) =>
              param.type.kind === "primitive" && param.type.type === "string"
                ? param.name
                : `${param.name}: String(${param.name})`,
            )
            .join(", ")} }`,
        ]),
    `organizationScoped: ${String(method.orgScoped)}`,
    `authenticated: ${String(method.security.kind !== "none")}`,
    `retrySafe: ${String(method.retrySafe)}`,
    // An optional key is the caller's to give through `idempotencyKey`.
    `idempotencyKey: ${literal(method.idempotencyKey === "required" ? "required" : "none")}`,
    ...(query === null ? [] : [`query: ${query}`]),
    ...(bodyExpression === null ? [] : [`body: ${bodyExpression}`]),
    ...(body === null || body.contentType === JSON_CONTENT_TYPE
      ? []
      : [`contentType: ${literal(body.contentType)}`]),
    ...(body === null || body.binaryParts.length === 0
      ? []
      : [`binaryParts: ${JSON.stringify(body.binaryParts)}`]),
    ...(conditionalWrite ? ["ifMatch: options?.ifMatch"] : []),
    ...(conditionalRead ? ["ifNoneMatch: options?.ifNoneMatch"] : []),
    ...(response.kind === "writeResult" || response.kind === "empty"
      ? [`response: { kind: ${literal(response.kind)} }`]
      : response.kind === "binary"
        ? [
            `response: { kind: "binary", contentType: ${literal(response.contentType)}, stream: options?.asStream === true }`,
          ]
        : []),
    "options",
  ].join(",\n");

  const withLastResponse = (type: string) =>
    `Promise<${imports.core("response", "WithLastResponse")}<${type}>>`;
  const { returnType, call, trailing, overloads } = ((): {
    returnType: string;
    call: string;
    trailing?: string;
    /** Public signatures that narrow the return type by the options. */
    overloads?: readonly string[];
  } => {
    switch (response.kind) {
      case "page": {
        if (method.pagination === null) {
          throw new Error(`${where}: a page response needs pagination`);
        }
        const { style, cursorParam, itemType } = method.pagination;
        const item = renderType(itemType, imports);
        return {
          returnType: `${imports.core("pagination", "PagePromise")}<${item}>`,
          call: `${imports.coreValue("pagination", "requestPage")}<${item}>(this.#requester, `,
          trailing: `, { style: ${literal(style)}, cursorParam: ${literal(cursorParam)} }`,
        };
      }
      case "empty":
        return {
          returnType: `Promise<${imports.core("response", "EmptyResponse")}>`,
          call: "this.#requester.request<object>(",
        };
      case "binary": {
        const bytes = imports.core("response", "BinaryResponse");
        const stream = imports.core("response", "BinaryStreamResponse");
        const either = withLastResponse(`${bytes} | ${stream}`);
        return {
          returnType: either,
          call: `this.#requester.request<${bytes} | ${stream}>(`,
          overloads: [
            `${method.name}(${signatureWith(`${requestOptions} & { readonly asStream: true }`, true)}): ${withLastResponse(stream)};`,
            `${method.name}(${signatureWith(`${requestOptions} & { readonly asStream?: false }`)}): ${withLastResponse(bytes)};`,
            `${method.name}(${signatureWith(requestOptions)}): ${either};`,
          ],
        };
      }
      case "operation": {
        // `src/core/operations.ts` builds on the Operation model by name.
        if (response.type.name !== "Operation") {
          throw new Error(`${where}: an operation response must be Operation`);
        }
        const result = OPERATION_RESPONSES[method.operationId];
        const type = `${imports.core("operations", "Operation")}${result === undefined ? "" : `<${imports.core("operations", result)}>`}`;
        return {
          returnType: `Promise<${type}>`,
          call: `${imports.coreValue("operations", "requestOperation")}${result === undefined ? "" : `<${result}>`}(this.#requester, `,
        };
      }
      case "model":
      case "writeResult": {
        const type = renderType(response.type, imports);
        if (conditionalRead) {
          const notModified = imports.core("response", "NotModified");
          const either = `Promise<${imports.core("response", "WithLastResponse")}<${type}> | ${notModified}>`;
          const etag = imports.core("request-options", "ETagSource");
          const plain = imports.core("request-options", "RequestOptions");
          return {
            returnType: either,
            call: `this.#requester.request<${type} | ${notModified}>(`,
            overloads: [
              `${method.name}(${signatureWith(`${requestOptions} & { readonly ifNoneMatch: ${etag} }`, true)}): ${either};`,
              `${method.name}(${signatureWith(`${plain} & { readonly ifNoneMatch?: never }`)}): ${withLastResponse(type)};`,
              `${method.name}(${signatureWith(requestOptions)}): ${either};`,
            ],
          };
        }
        return {
          returnType: withLastResponse(type),
          call: `this.#requester.request<${type}>(`,
        };
      }
    }
  })();

  const destructuring = destructure
    ? `const { ${method.queryParams.map((param) => param.name).join(", ")}, ...body }${paramsRequired ? " = params" : `: ${typeName} = params ?? {}`};\n`
    : "";
  const conditionNote =
    method.ifMatch === "required"
      ? "Pass the object's current ETag as `ifMatch`, such as the object you read: `{ ifMatch: object }`. Without it the API refuses the write with `PreconditionFailedError` (428); with a stale one, the same error (412)."
      : method.ifMatch === "optional"
        ? "Pass `ifMatch` to make the call conditional on the object's ETag; a stale one raises `PreconditionFailedError` (412)."
        : response.kind === "binary"
          ? "Resolves with the whole file in `data`, or with `asStream: true`, as a web `ReadableStream` in `stream`."
          : response.kind === "operation"
            ? "Resolves with an Operation; `await operation.wait()` for its final state."
            : conditionalRead
              ? "Pass the ETag of the copy you hold as `ifNoneMatch` (or the copy itself) to skip the transfer when it's current: the call then resolves `NotModified`."
              : null;
  const doc = docComment([method.summary, method.description, conditionNote]);
  const source = `${(overloads ?? []).map((overload) => `${doc}${overload}\n`).join("")}${overloads === undefined ? doc : ""}${method.name}(${signatureWith(requestOptions)}): ${returnType} {\n${destructuring}return ${call}{\n${spec}\n}${trailing ?? ""});\n}\n`;
  return {
    params,
    method: source,
    exports: hasParams ? [typeName] : [],
  };
};

/** A resource in the client's tree, with or without methods of its own. */
interface ResourceNode {
  readonly path: readonly string[];
  readonly methods: readonly IrMethod[];
  readonly children: readonly ResourceNode[];
}

const resourceTree = (
  resources: readonly IrResource[],
): readonly ResourceNode[] => {
  const key = (path: readonly string[]) => path.join(".");
  const paths = new Map<string, readonly string[]>();
  resources.forEach((resource) => {
    resource.path.forEach((_, index) => {
      const prefix = resource.path.slice(0, index + 1);
      paths.set(key(prefix), prefix);
    });
  });
  const methodsOf = new Map(
    resources.map((resource) => [key(resource.path), resource.methods]),
  );
  const build = (path: readonly string[]): ResourceNode => ({
    path,
    methods: [...(methodsOf.get(key(path)) ?? [])].sort((a, b) =>
      byCodePoint(a.name, b.name),
    ),
    children: [...paths.values()]
      .filter(
        (candidate) =>
          candidate.length === path.length + 1 &&
          key(candidate.slice(0, path.length)) === key(path),
      )
      .sort((a, b) => byCodePoint(key(a), key(b)))
      .map(build),
  });
  return [...paths.values()]
    .filter((path) => path.length === 1)
    .sort((a, b) => byCodePoint(key(a), key(b)))
    .map(build);
};

const flatten = (nodes: readonly ResourceNode[]): readonly ResourceNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.children)]);

const resourceSource = (
  context: Context,
  node: ResourceNode,
): { source: string; exports: readonly string[] } => {
  const imports = new Imports();
  const className = `${resourceClassName(node.path)}${isExtended(node.path) ? "Base" : ""}`;
  const resource: IrResource = { path: node.path, methods: node.methods };
  const methods = node.methods.map((method) =>
    methodSource(context, resource, method, imports),
  );
  const requester = imports.core("requester", "Requester");
  const children = node.children.map((child) => ({
    property: child.path.at(-1) ?? "",
    ...exposedClass(child.path),
  }));
  const fields = [
    ...(methods.length === 0 ? [] : [`readonly #requester: ${requester};`]),
    ...children.map(
      (child) => `readonly ${child.property}: ${child.className};`,
    ),
  ];
  const assignments = [
    ...(methods.length === 0 ? [] : ["this.#requester = requester;"]),
    ...children.map(
      (child) => `this.${child.property} = new ${child.className}(requester);`,
    ),
  ];
  const childImports = children.map(
    (child) => `import { ${child.className} } from "${child.specifier}";`,
  );
  const importLines = [
    imports.render((name) => `../models/${modelFileName(name)}.js`, "../core"),
    ...childImports,
  ].join("\n");
  const classDoc = isExtended(node.path)
    ? docComment([
        `The generated methods of \`${node.path.join(".")}\`. The client exposes the hand-written subclass in \`src/extensions/${resourceFileName(node.path)}.ts\`.`,
      ])
    : "";
  const source = `${BANNER}\n${importLines}\n\n${methods.map((method) => method.params).join("\n")}\n${classDoc}export class ${className} {\n${fields.join("\n")}\n\nconstructor(requester: ${requester}) {\n${assignments.join("\n")}\n}\n\n${methods.map((method) => method.method).join("\n")}}\n`;
  return {
    source,
    // The classes stay internal: a type-only re-export of a class still
    // reads as a constructible value in the bundled `.d.ts`.
    exports: methods.flatMap((method) => method.exports),
  };
};

const apiResourcesSource = (roots: readonly ResourceNode[]): string => {
  const entries = roots.map((root) => ({
    property: root.path[0] ?? "",
    ...exposedClass(root.path),
  }));
  const imports = entries
    .map((entry) => `import { ${entry.className} } from "${entry.specifier}";`)
    .join("\n");
  return `${BANNER}
import type { Requester } from "../core/requester.js";
${imports}

/** Every API resource, as properties of the client. */
export class ApiResources {
${entries.map((entry) => `readonly ${entry.property}: ${entry.className};`).join("\n")}

constructor(requester: Requester) {
${entries.map((entry) => `this.${entry.property} = new ${entry.className}(requester);`).join("\n")}
}
}
`;
};

/**
 * One file per resource in `src/resources/`, the `ApiResources` base the
 * client extends, and an index of the public types.
 */
export const generateResources = (ir: Ir): ReadonlyMap<string, string> => {
  const context = new Context(ir);
  const roots = resourceTree(ir.resources);
  const paths = new Set(flatten(roots).map((node) => node.path.join(".")));
  EXTENDED_RESOURCES.forEach((path) => {
    if (!paths.has(path)) {
      throw new Error(`Extended resource "${path}" is not in the IR`);
    }
  });
  const files = new Map<string, string>();
  const exports: string[] = [];
  flatten(roots).forEach((node) => {
    const file = resourceFileName(node.path);
    const { source, exports: names } = resourceSource(context, node);
    files.set(`src/resources/${file}.ts`, source);
    if (names.length > 0) {
      exports.push(`export type { ${names.join(", ")} } from "./${file}.js";`);
    }
  });
  files.set("src/resources/api-resources.ts", apiResourcesSource(roots));
  files.set("src/resources/index.ts", `${BANNER}\n${exports.join("\n")}\n`);
  return files;
};
