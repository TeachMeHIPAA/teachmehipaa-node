# stripe-node: design research for `teachmehipaa-node`

Source snapshot: `stripe/stripe-node` @ `6237106` (2026-11-10), package
`stripe@23.1.0`, pinned API `2026-10-28.endive`. Shallow clone at
`~/scratch/stripe-src/stripe-node`.

Citation format: `path:Lnn` links to the pinned commit. Base URL:
`https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/`
(all links below are permalinks to this commit). Docs citations go to `docs.stripe.com`, fetched
2026-11-15.

---

## TL;DR

1. **One TS codebase, two emitted formats.** `tsc` builds `esm/` and `cjs/`. Runtime-specific entry files call `Stripe.initialize(platformFunctions)`, and `package.json#exports` routes `node` / `worker` / `workerd` / `deno` / `bun` / `browser` to the right entry. Zero runtime dependencies. Node ≥ 20.
2. **Resources are generated, the core is hand-written.** Each resource is a subclass of `StripeResource` whose methods call `this._makeRequest(method, path, params, options, spec)`. A banner (`// File generated from our OpenAPI spec`) marks generated files, and comment fences mark generated blocks inside hand-written ones. The codegen itself is private.
3. **Call shape is fixed:** `resource.method(...pathIds, params?, options?)`. Since v22, params and options are never mixed, and callbacks and positional API keys are gone. Custom methods such as `paymentIntents.cancel(id)` are ordinary named methods that POST to `/{id}/cancel`.
4. **Auth is a pluggable `authenticator: (req) => Promise<void>`.** It runs once per attempt, retries included, and can be set on the client or per request. This is the hook a token-caching OAuth layer would use.
5. **Retries:** default `maxNetworkRetries = 2` in code (the README still says 1). Backoff is `0.5s·2^(n-1)`, capped at 5s, with 50–100% jitter and a 0.5s floor. Retried cases: connection errors, 409, 5xx, and `Stripe-Should-Retry: true`. A response with `Stripe-Should-Retry: false` is not retried. `Retry-After` is **not** honored (support was removed in 22.3.1). Every v1 POST and every v2 POST/DELETE gets an automatic `Idempotency-Key`.
6. **Errors:** `StripeError extends Error`, carrying `type`, `rawType`, `code`, `statusCode`, `requestId`, `headers`, `raw` and `detail`. v1 errors map by HTTP status. v2 errors map by the body's `type` through a generated switch. OAuth errors map by the RFC 6749 `error` string.
7. **Pagination:** list and search calls return a Promise that is also an `AsyncIterator`, with `autoPagingEach` and `autoPagingToArray` attached (the latter capped at 10k). v1 pages with `starting_after`. v2 follows the opaque `next_page_url`.
8. **Webhooks:** the header is `Stripe-Signature: t=…,v1=…`, verified as HMAC-SHA256 over `"${t}.${rawBody}"` with a constant-time compare. Default tolerance is 300s. Sync and async (SubtleCrypto) variants exist, plus `generateTestHeaderString`. v2 "thin" events come with `parseEventNotification` and a typed `notificationHandler` router.
9. **HTTP layer:** an `HttpClient` interface with `NodeHttpClient` (keep-alive agents) and `FetchHttpClient` (AbortController timeout covering the whole request). The client emits `request` and `response` events and sends `User-Agent`, `X-Stripe-Client-User-Agent` (JSON) and `X-Stripe-Client-Telemetry` (previous request's latency).
10. **Versioning:** each SDK major pins one API version (`src/apiVersion.ts`) and its types reflect only that version. An API major bump means an SDK major bump. Releases are driven by `hark` change files and published to npm through OIDC on a `v*` tag. Tests run against `stripe-mock` (an OpenAPI-driven mock server) with Mocha.

---

## 1. Repo layout, build, language, module formats, runtimes

**Layout** (top level of the clone):

```
src/                  # all TypeScript source (hand-written core + generated resources)
  stripe.core.ts      # the Stripe class (hand-written, with generated fenced blocks)
  stripe.{cjs,esm}.{node,worker,extensibility}.ts   # runtime entry points
  RequestSender.ts    # HTTP orchestration: headers, retries, error mapping
  StripeResource.ts   # base class for every resource
  autoPagination.ts  Error.ts  Webhooks.ts  multipart.ts  utils.ts  lib.ts  Types.ts
  net/                # HttpClient interface + Node / Fetch / EndpointFetch impls
  crypto/             # CryptoProvider + Node / SubtleCrypto impls
  platform/           # PlatformFunctions + Node / Web / Extensibility impls
  resources/          # GENERATED: one file per resource; nested dirs = namespaces; V2/ tree
test/                 # mocha specs; resources/generated_examples_test.spec.js is generated
testProjects/         # cjs, mjs, cjs-ts, mjs-ts, bun, cloudflare-worker, cloudflare-pages, esbuild, types*
eslint-rules/wintertc-compat.js   # custom lint rule enforcing cross-runtime APIs
.hark/                # changelog source (change files, migration guides, releases.json)
justfile  Makefile(deprecated)  VERSION  OPENAPI_VERSION  CODEGEN_VERSION
```

- **Language:** TypeScript 4.9, `strict`, `noImplicitAny`, `target es2020`, and `esModuleInterop: false` ("a viral option, do not enable"). See [`tsconfig.cjs.json`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/tsconfig.cjs.json). Since v22 the types live inline in `src/`. The old hand-plus-generated `types/` folder is gone ([`CHANGELOG.md:L631`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/CHANGELOG.md#L631)).
- **Build:** plain `tsc`, run twice: `tsconfig.cjs.json` → `cjs/` and `tsconfig.esm.json` (`module: es2022`) → `esm/`. Each output directory gets its own `package.json` declaring `{"type":"commonjs"|"module"}` ([`justfile`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/justfile), `_build` recipe). There is no bundler. The ESM build excludes the CJS entry files and vice versa ([`tsconfig.esm.json`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/tsconfig.esm.json)).
- **Package:** `"main": "cjs/stripe.cjs.node.js"`, `"dependencies": {}`, and `@types/node` as an *optional* peer dependency ([`package.json`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/package.json)). `.npmignore` is an allowlist: `cjs/`, `esm/`, `VERSION`, `OPENAPI_VERSION`, README, CHANGELOG ([`.npmignore`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/.npmignore)).
- **Conditional exports** ([`package.json`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/package.json) `exports`):

  ```jsonc
  "browser" | "bun" | "deno" | "worker" | "workerd": { "import": "./esm/stripe.esm.worker.js", "require": "./cjs/stripe.cjs.worker.js" },
  "extensibility": { ... stripe.*.extensibility.js },
  "default": { "import": {"types": "./esm/stripe.esm.node.d.ts", "default": "./esm/stripe.esm.node.js"},
               "require": {"types": "./cjs/stripe.cjs.node.d.ts", "default": "./cjs/stripe.cjs.node.js"} }
  ```

  Bun therefore gets the **worker/fetch** build, not the Node build.
- **Minimum runtime:** `"engines": {"node": ">=20"}`. CI tests Node 20, 22 and 24 on Ubuntu, plus Node 24 on Windows ([`.github/workflows/main.yml`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/.github/workflows/main.yml)). Policy, per [docs.stripe.com/sdks/versioning](https://docs.stripe.com/sdks/versioning?lang=node): "We support LTS (even numbered) versions of Node 20+", with a one-year extended window after EOL, and support is dropped with the September API major.

**Platform abstraction.** `PlatformFunctions` is a base class of runtime-dependent hooks ([`src/platform/PlatformFunctions.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/platform/PlatformFunctions.ts)):

- `uuid4` (requires `crypto.randomUUID` and deliberately throws instead of falling back to `Math.random`, L100)
- `secureCompare`, `createEmitter`, `tryBufferData`
- `createDefaultHttpClient`, `createNodeHttpClient`, `createFetchHttpClient`
- `createDefaultCryptoProvider`, `getEnv`, `getRuntimeVersion`, `getPlatformInfo`, `getTelemetryId`, `emitWarning`
- `getDefaultMaxNetworkRetries` (returns `2`, L84)
- `createDefaultAuthenticator`

Implementations:

- `NodePlatformFunctions` uses `http`/`https` with keep-alive agents, `crypto.timingSafeEqual`, `EventEmitter`, `process.emitWarning`, and a telemetry ID persisted to `~/.config/stripe/telemetry_id` ([`src/platform/NodePlatformFunctions.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/platform/NodePlatformFunctions.ts)).
- `WebPlatformFunctions` uses `FetchHttpClient`, `SubtleCryptoProvider` and a tiny `StripeEmitter`. Stream uploads are rejected ([`src/platform/WebPlatformFunctions.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/platform/WebPlatformFunctions.ts)).
- `ExtensibilityPlatformFunctions` targets Stripe's own Deno-based script runtime: retries default to 0, the authenticator is a no-op because auth is injected by the host, and it uses an `endpointFetch` client ([`src/platform/ExtensibilityPlatformFunctions.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/platform/ExtensibilityPlatformFunctions.ts)).

Each entry file is a few lines. Example, [`src/stripe.esm.worker.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.esm.worker.ts):

```ts
import {WebPlatformFunctions} from './platform/WebPlatformFunctions.js';
import {Stripe} from './stripe.core.js';
Stripe.initialize(new WebPlatformFunctions());
export {Stripe};
export default Stripe;
```

**Portability is enforced by lint.** The custom rule [`eslint-rules/wintertc-compat.js`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/eslint-rules/wintertc-compat.js) flags APIs outside the WinterTC Minimum Common API (ECMA-429). It is set to `error` for `src/**/*.ts` and turned off only for `src/**/Node*.ts` and `src/stripe.*.node.ts` ([`.eslintrc.js:L290-L304`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/.eslintrc.js#L290)). Runtime coverage is proven by `testProjects/` (bun, cloudflare-worker, cloudflare-pages, esbuild, cjs/mjs, TS) driven from [`test/Integration.spec.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/test/Integration.spec.ts), and CI installs Deno for one integration test ([`.github/actions/test/action.yml`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/.github/actions/test/action.yml)).

> Observed wart: `src/stripe.esm.node.ts` is a near-verbatim copy of `stripe.core.ts` and has **drifted**. It hardcodes `maxNetworkRetries` to `2`, lacks `createDefaultAuthenticator`, lacks `telemetry_id` and lacks the v1-event guard (run `diff src/stripe.core.ts src/stripe.esm.node.ts`). The lesson for us is one core module plus thin entry files, never a copy.

## 2. Client construction and config

```ts
import Stripe from 'stripe';
const stripe = new Stripe('sk_test_...', {
  apiVersion: '2026-10-28.endive', maxNetworkRetries: 2, timeout: 20_000,
  httpClient: Stripe.createFetchHttpClient(), appInfo: {name: 'MyPlugin', version: '1.0'},
  telemetry: false, stripeContext: 'acct_123', host: 'localhost', port: 12111, protocol: 'http',
});
```

- **Constructor:** `constructor(key: string, config?: StripeConfig)` ([`src/stripe.core.ts:L1157`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts#L1157)). The CJS entry wraps it so that `Stripe(key)` without `new` still works ([`src/stripe.cjs.node.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.cjs.node.ts)). For backward compatibility, a string passed as `config` is treated as `apiVersion` (`_getPropsFromConfig`, [`src/stripe.core.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts)).
- **Unknown config keys throw.** The allowlist is `ALLOWED_CONFIG_PROPERTIES`: `authenticator, apiVersion, typescript, maxNetworkRetries, httpAgent, httpClient, timeout, host, port, protocol, telemetry, emitEventBodies, appInfo, stripeAccount, stripeContext` ([`src/stripe.core.ts:L957`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts#L957)).
- **Public config type:** `StripeConfig` is JSDoc'd per field ([`src/lib.ts:L17`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/lib.ts#L17)).
- **Defaults** ([`src/stripe.core.ts:L941-L950`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts#L941), `_api` block at [L1183](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts#L1183)):

  | setting | default |
  |---|---|
  | host / port / protocol | `api.stripe.com` / `443` / `https` |
  | basePath | `/v1/` (resources pass full paths, so it is effectively unused) |
  | apiVersion | `ApiVersion` from `src/apiVersion.ts` (`2026-10-28.endive`) |
  | timeout | `80000` ms |
  | maxNetworkRetries | `platformFunctions.getDefaultMaxNetworkRetries()` → **2** (Node/Web), 0 (extensibility). The README table still says 1 ([README.md:L251](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/README.md#L251)). Tests assert 2 ([`test/stripe.spec.ts:L798`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/test/stripe.spec.ts#L798)). |
  | retry delays | initial `0.5s`, max `5s` (constants, not configurable) |
  | telemetry | on (`props.telemetry !== false`, [L1227](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts#L1227)) |
  | emitEventBodies | off |
  | httpClient | `httpAgent ? createNodeHttpClient(agent) : createDefaultHttpClient()` |

- **Hosts by API base:** `DEFAULT_BASE_ADDRESSES = {api, files: 'files.stripe.com', connect: 'connect.stripe.com', meter_events: …}` ([`src/Types.ts:L22`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/Types.ts#L22)). Resource methods choose one with `spec.apiBase` (for example, file upload and PDF download go to `files`). A custom `host` overrides all of them globally (`resolveBaseAddress`). The per-request host override was **removed in v22** ([`CHANGELOG.md`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/CHANGELOG.md) 22.0.0, #2643).
- **Authentication:** `key` and `config.authenticator` are mutually exclusive, and one is required (`_setAuthenticator`, [`src/stripe.core.ts:L1342`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts#L1342)). A key becomes `createApiKeyAuthenticator(key)`, which sets `Authorization: Bearer <key>` ([`src/utils.ts:L394`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/utils.ts#L394)). The type is `RequestAuthenticator = (request: StripeRequest) => Promise<void>` ([`src/Types.ts:L106`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/Types.ts#L106)). It receives a mutable `{host, port, path, method, headers, body, protocol}`.
- **Immutable derived clients:** `withStripeContext(ctx)` builds a new client with the same config, emitter and telemetry buffer ([`src/stripe.core.ts:L1779`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts#L1779)). This is the template for a scoped client (for example, `client.withOrganization(orgId)`).
- **Static process-wide setup:** `Stripe.initialize()` also detects AI agents from env vars (`AI_AGENTS`, [`src/utils.ts:L368`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/utils.ts#L368)) and adds `AIAgent/<name>` to the UA. It even writes a `<claude-code-hint …/>` line to stderr when `CLAUDECODE` is set ([`src/stripe.core.ts:L1139`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts#L1139)). This is product telemetry we should not copy.

## 3. Resource / service organization

- **Generated vs. hand-written** ([`CONTRIBUTING.md`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/CONTRIBUTING.md)): "To identify files with purely generated code, look for the comment `File generated from our OpenAPI spec.` … Generated blocks of code within hand-written files will be between comments that say `The beginning of the section generated from our OpenAPI spec` and `The end of …`". For example, `stripe.core.ts` has fenced `StripeInstanceImports`, `StripeInstanceVariables`, `StripeInitInstanceVariables` and `StripeInterfaceExports` blocks ([`src/stripe.core.ts:L67`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts#L67), [L1232](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts#L1232)). `Error.ts`, `Types.ts` and `utils.ts` (`AI_AGENTS`) also contain fenced generated blocks. The generator lives in a private repo (`import? '../sdk-codegen/utils.just'` in the [`justfile`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/justfile)), and its commit is recorded in [`CODEGEN_VERSION`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/CODEGEN_VERSION).
- **Resource shape** ([`src/resources/PaymentIntents.ts:L32-L160`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/resources/PaymentIntents.ts#L32)). Path params are always `encodeURIComponent`'d inline, and types live in the same file (`PaymentIntent`, `PaymentIntentCreateParams`, and a `namespace PaymentIntent {…}` for nested types):

  ```ts
  export class PaymentIntentResource extends StripeResource {
    list(params?: PaymentIntentListParams, options?: RequestOptions): ApiListPromise<PaymentIntent> {
      return this._makeRequest('GET', '/v1/payment_intents', params, options, {methodType: 'list'}) as any;
    }
    retrieve(id: string, params?: PaymentIntentRetrieveParams, options?: RequestOptions): Promise<Response<PaymentIntent>> {
      return this._makeRequest('GET', `/v1/payment_intents/${encodeURIComponent(id)}`, params, options) as any;
    }
    cancel(id: string, params?: PaymentIntentCancelParams, options?: RequestOptions): Promise<Response<PaymentIntent>> {
      return this._makeRequest('POST', `/v1/payment_intents/${encodeURIComponent(id)}/cancel`, params, options) as any;
    }
  }
  ```

- **The single request primitive** is `StripeResource._makeRequest(method, path, params, options, spec?)` ([`src/StripeResource.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/StripeResource.ts)). It sends GET/DELETE params in the query string and everything else in the body. It applies `spec.validator`, `spec.requestSchema` / `responseSchema` (v2 int64/decimal coercion, [`src/V2Coercion.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/V2Coercion.ts)) and `spec.transformResponseData`. It captures the caller's stack before the async hop so errors show the user's call site (`attachCallSiteToError`, [`src/utils.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/utils.ts)). When `spec.methodType` is `list` or `search`, it attaches the pagination methods. `MakeRequestSpec` is the per-method knob set: `methodType, streaming, validator, headers, apiBase, encode, usage, requestSchema, responseSchema, transformResponseData` ([`src/Types.ts:L248`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/Types.ts#L248)).
- **Method naming:**
  - CRUD is `create / retrieve / update / list / del` (`del`, not `delete`), plus `search`.
  - Custom (non-CRUD) actions are camelCase verbs on the parent resource: `cancel`, `capture`, `confirm`, `incrementAuthorization`, `applyCustomerBalance`. Each is just a POST to `/{id}/{action}`.
  - **v1 flattens sub-resources** onto the parent: `customers.createTaxId(customerId, params)`, `customers.listBalanceTransactions(customerId)`, `accounts.retrieveCapability(acct, cap)` ([`src/resources/Customers.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/resources/Customers.ts), method list at L600–L951).
  - **v2 nests them:** `stripe.v2.core.accounts.persons.create(accountId, …)`, where `AccountResource` has a `persons: PersonResource` property ([`src/resources/V2/Core/Accounts.ts:L17`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/resources/V2/Core/Accounts.ts#L17)). v2 methods also carry `@throws Stripe.RateLimitError`-style JSDoc.
  - Update is POST on both v1 and v2 (no PATCH).
- **Namespacing:** directories under `src/resources/` (`Billing/`, `Issuing/`, `V2/Core/…`) become property chains: `stripe.billing.meters`, `stripe.v2.core.eventDestinations`. Old style: the `resourceNamespace()` helper ([`src/ResourceNamespace.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/ResourceNamespace.ts)). New style: a generated `index.ts` class per namespace ([`src/resources/V2/Core/index.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/resources/V2/Core/index.ts)). The root wires everything in `this.v2 = new V2(this)` ([`src/stripe.core.ts:L1309`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts#L1309)).
- **v1 vs v2 mode** is inferred from the path prefix: `getAPIMode(path) => path.startsWith('/v2') ? 'v2' : 'v1'` ([`src/utils.ts:L476`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/utils.ts#L476)). The mode drives the encoding (form-encoded for v1, JSON for v2), the idempotency policy, the error mapper and the paginator. `validatePath` rejects anything not starting with a single `/` before the mode is sniffed ([`src/utils.ts:L459`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/utils.ts#L459)).

## 4. Per-request options

`RequestOptions` is always the **last** argument and is never merged with params (v22 breaking change, [`CHANGELOG.md`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/CHANGELOG.md) #2645: "If present on a method, `RequestParams` must always come first and `RequestOptions` must always come second. To supply options without params, pass `undefined`").

```ts
await stripe.customers.create({email}, {
  idempotencyKey: 'order-42', stripeContext: 'acct_123', apiVersion: '2026-10-28.endive',
  timeout: 5000, maxNetworkRetries: 0, headers: {'X-Foo': 'bar'}, apiKey: 'sk_…' /* or authenticator */,
});
```

- Definition: [`src/lib.ts:L118`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/lib.ts#L118). Conversion to headers and settings happens in `processOptions` ([`src/utils.ts:L196`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/utils.ts#L196)):
  - `idempotencyKey` → `Idempotency-Key`
  - `stripeAccount` → `Stripe-Account`
  - `stripeContext` → `Stripe-Context` (throws if both are set)
  - `apiVersion` → `Stripe-Version`
  - `timeout` / `maxNetworkRetries` → `settings`
  - `apiKey` or `authenticator` → a per-request authenticator (the two are mutually exclusive)
  - `headers` are merged last, and `streaming` is a flag
- Header precedence: user headers are normalized to canonical case so that they *replace* defaults instead of duplicating them ([`src/RequestSender.ts:L445-L512`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/RequestSender.ts#L445)).
- **Docs drift:** [docs.stripe.com/sdks/set-version](https://docs.stripe.com/sdks/set-version?lang=node) still shows `paymentIntents.retrieve('pi_…', {apiVersion: …})`, with the option in the params slot. That pattern stopped working in v22. The same page links an `API_VERSION` file that no longer exists in the repo (the version now lives in `src/apiVersion.ts`).

## 5. Pagination

- **Promise + AsyncIterator hybrid:** `ApiListPromise<T> extends Promise<Response<ApiList<T>>>, AsyncIterableIterator<T>` with `autoPagingEach(handler)` and `autoPagingToArray({limit})` ([`src/lib.ts:L224`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/lib.ts#L224)). The same shape exists for `V2ListPromise`, `ApiSearchResultPromise` and `V2SearchResultPromise`.

  ```ts
  const page = await stripe.customers.list({limit: 100});          // one page
  for await (const c of stripe.customers.list({limit: 100})) {...}  // all items
  await stripe.customers.list().autoPagingEach(async (c) => { if (done) return false; });
  const arr = await stripe.customers.list().autoPagingToArray({limit: 10000});
  ```

- **Implementation** ([`src/autoPagination.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/autoPagination.ts)): `makeAutoPaginationMethods` (L278) picks an iterator.
  - `V1ListIterator` (L138) re-requests with `starting_after = lastItem.id`. If `ending_before` was passed, it iterates in reverse.
  - `V1SearchIterator` (L156) sends `page = next_page`.
  - `V2ListIterator` (L177) GETs the server's opaque `next_page_url` and keeps the original options. v2 search POSTs with a snapshot of the original params.
  - `next()` de-duplicates concurrent calls so parallel `next()` can't double-turn a page.
  - `autoPagingToArray` throws without a `limit` and caps it at 10,000 (L496).
  - `autoPagingEach` accepts sync, async and `(item, next)` callbacks. Returning `false` stops iteration.
- **Wire shapes:**
  - v1 `ApiList` is `{object:'list', data, has_more, url}`. v1 search adds `next_page`.
  - `V2List` is `{data, next_page_url, previous_page_url}` ([`src/lib.ts:L247`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/lib.ts#L247)).
  - Docs, [docs.stripe.com/api-v2-overview#list-pagination](https://docs.stripe.com/api-v2-overview): "Specify the `page` token for list API requests. Use the `previous_page_url` and `next_page_url` properties … You can't change list filters after the first request."

## 6. Errors

- **Hierarchy** ([`src/Error.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/Error.ts)): `StripeError extends Error` (L134), with these subclasses:
  - `StripeCardError` (402), `StripeInvalidRequestError` (400/404), `StripeAuthenticationError` (401), `StripePermissionError` (403), `StripeRateLimitError` (429, or 400 with `code=rate_limit`), `StripeIdempotencyError`, `StripeAPIError` (fallback, also malformed JSON), `StripeConnectionError` (network, timeout, truncated body), `StripeSignatureVerificationError` (webhooks, L326)
  - `StripeOAuthError` → `InvalidGrant`, `InvalidClient`, `OAuthInvalidRequest`, `InvalidScope`, `UnsupportedGrantType`, `UnsupportedResponseType`
  - generated v2 domain errors: `AlreadyCanceledError`, `NotCancelableError`, `QuotaExceededError`, `RateLimitError`, and others
- **Fields** (all `readonly`): `message, userMessage, type` (the class name, so it survives minification; `testProjects/esbuild` verifies this), `raw, rawType, headers, requestId, detail, statusCode`, plus generated API fields `code, decline_code, doc_url, param, request_log_url, …`. Exported as `Stripe.errors.*` (`static errors = _Error`).
- **Mapping** ([`src/RequestSender.ts:L178`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/RequestSender.ts#L178) `_jsonResponseHandler`): any JSON body containing `error` is an error.
  - If `error` is a string, the response is OAuth-shaped (`{error, error_description}`): it is normalized and passed to `generateOAuthError`, which switches on the RFC 6749 code (L47).
  - Otherwise it goes to `generateV2Error` (switch on `error.type`, then on `code === 'invalid_fields'`, then falls back to v1, L70) or `generateV1Error` (switch on HTTP status, L13).
  - `headers`, `statusCode` and `requestId` (from the `request-id` header) are stamped onto the raw error before construction.
  - A body that cannot be parsed raises `StripeAPIError('Invalid JSON…')`. A body cut off mid-read raises `StripeConnectionError` (v23 change, [`.hark/migration-guides/v23.md`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/.hark/migration-guides/v23.md)).
- **Success metadata:** results get a non-enumerable `lastResponse: {headers, requestId, statusCode, apiVersion, idempotencyKey, stripeAccount}` (`Response<T>`, [`src/lib.ts:L187`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/lib.ts#L187)).

## 7. Retries

`RequestSender._shouldRetry` ([`src/RequestSender.ts:L322`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/RequestSender.ts#L322)):

1. `ECONNRESET` / `EPIPE` on the first attempt → retry once **even if `maxNetworkRetries` is 0**. The usual cause is a stale keep-alive socket, for example after a frozen Lambda (README "Network retries" note).
2. `numRetries >= maxRetries` → stop.
3. No response (connection error or timeout) → retry.
4. `stripe-should-retry: false` → stop. `stripe-should-retry: true` → retry.
5. `409` → retry. `>= 500` → retry. Anything else → stop. There is **no** automatic retry on 429 unless the server sets `Stripe-Should-Retry: true`.

Backoff (`_getSleepTimeInMS`, [L379](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/RequestSender.ts#L379)):

```ts
sleep = min(0.5 * 2^(n-1), 5);        // seconds
sleep *= 0.5 * (1 + Math.random());   // jitter: 50–100%
sleep = max(0.5, sleep);              // floor
```

- **`Retry-After`:** not read anywhere in `src/` (grep returns nothing). Support was explicitly removed in 22.3.1 as unused ([`CHANGELOG.md:L414`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/CHANGELOG.md#L414), #2781).
- **Automatic idempotency** (`_defaultIdempotencyKey`, [L409](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/RequestSender.ts#L409)): `stripe-node-retry-<uuid4>` is added to every v1 POST (even with retries off, because of rule 1) and to every v2 POST and DELETE. It is generated once, before the first attempt, and reused for every retry. A user-supplied key overrides it.
- **Docs** ([docs.stripe.com/error-low-level](https://docs.stripe.com/error-low-level)): "`true`: Retry the request using exponential backoff … `false`: Don't retry … Stripe SDKs respect this header automatically". "Stripe retains keys for at least 24 hours" for v1. v2 replays within 30 days and "re-executes the failed requests" instead of replaying a cached error ([api-v2-overview#idempotency](https://docs.stripe.com/api-v2-overview)).
- The authenticator is invoked **inside** each attempt (`authenticator(request).then(...)`, [L705](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/RequestSender.ts#L705)), so a fresh token can be minted per retry. **Caveat found by inspection, not covered by tests:** if the authenticator rejects, the `.catch` re-throws inside a detached promise chain. The resource promise never settles and an unhandled rejection fires ([L705-L800](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/RequestSender.ts#L705)). Our token-fetch path must reject the caller's promise instead.
- A 401 is never retried and nothing refreshes credentials. That is fine for static keys but not for expiring JWTs.

## 8. HTTP layer, events, logging, telemetry, UA

- **Interface** ([`src/net/HttpClient.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/net/HttpClient.ts)):

  ```ts
  interface HttpClientInterface {
    getClientName(): string;
    makeRequest(host, port, path, method, headers, requestData: string, protocol, timeout): Promise<HttpClientResponseInterface>;
  }
  interface HttpClientResponseInterface {
    getStatusCode(); getHeaders(); getRawResponse(); toStream(onDone); toJSON(): Promise<any>; dispose?(): void;
  }
  ```

  The `HttpClient` and `HttpClientResponse` base classes and the `createFetchHttpClient(fetchFn?)` / `createNodeHttpClient(agent?)` factories are exposed statically, and a custom client is passed with `config.httpClient`.
- **FetchHttpClient** ([`src/net/FetchHttpClient.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/net/FetchHttpClient.ts)): one AbortController timeout covers headers *and* body read (issue #2814). It always sends a body for POST/PUT/PATCH to avoid Deno's duplicate Content-Length. `dispose()` cancels discarded bodies before a retry. `toStream()` releases the timeout so long downloads are not killed.
- **NodeHttpClient:** module-level keep-alive agents, with `req.setTimeout` resetting at each stage ([`src/net/NodeHttpClient.ts:L22`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/net/NodeHttpClient.ts#L22)).
- **Hooks:** the client is an emitter (`stripe.on('request'|'response', fn)`, `off`, `once`).
  - `request` event: `{api_version, account, idempotency_key, method, path, request_start_time, body?}`.
  - `response` event: adds `{status, request_id, elapsed, request_end_time, body?}`.
  - Bodies are included only with `emitEventBodies: true`, since they may contain sensitive data.
  - Sources: [`src/Types.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/Types.ts) `RequestEvent`/`ResponseEvent`; README "`request` and `response` events".
  - The SDK has no logger. It relies on the events, `emitWarning` for `Stripe-Notice` headers ([`src/RequestSender.ts:L106`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/RequestSender.ts#L106)), and `STRIPE_SUPPRESS_NOTICES`.
- **Default headers** (`_makeHeaders`, [L445](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/RequestSender.ts#L445)): `Accept: application/json`; `Content-Type` (form for v1, JSON for v2); `User-Agent`; `X-Stripe-Client-User-Agent`; `X-Stripe-Client-Telemetry`; `Stripe-Version`; `Stripe-Account` / `Stripe-Context`; `Idempotency-Key`; and `Content-Length` (always sent for POST/PUT/PATCH).
- **User-Agent** (`_getUserAgentString`, [L515](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/RequestSender.ts#L515)): `Stripe/v1 NodeBindings/23.1.0 MyPlugin/1.0 (https://url) AIAgent/claude_code`.
- **`X-Stripe-Client-User-Agent`:** a JSON string of `{bindings_version, lang:'node', lang_version, typescript, platform: "<os> <release> <arch>", httplib: 'node'|'fetch', application: appInfo, telemetry_id, ai_agent}`. `platform` and `telemetry_id` are sent only when telemetry is enabled (`getClientUserAgentSeeded`, [`src/stripe.core.ts:L1485`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts#L1485)).
- **`X-Stripe-Client-Telemetry`:** `{"last_request_metrics": {request_id, request_duration_ms, usage?}}` for the *previous* request, taken from a FIFO buffer capped at 100 entries (`_getTelemetryHeader` L532, `_recordRequestMetrics`). `usage` tags features such as `raw_request` and `fetch_event`.
- **`appInfo`:** `{name (required), version?, url?, partner_id?}` ([`src/lib.ts:L373`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/lib.ts#L373)), meant for plugin authors (README "Writing a Plugin").

## 9. Webhooks

- **API** ([`src/Webhooks.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/Webhooks.ts)):

  ```ts
  const event = stripe.webhooks.constructEvent(rawBody, sigHeader, secret, tolerance?, cryptoProvider?, receivedAt?);
  const event = await stripe.webhooks.constructEventAsync(...);           // SubtleCrypto (workers)
  stripe.webhooks.signature.verifyHeader(...) / verifyHeaderAsync(...);   // verify only
  stripe.webhooks.constructEventWithoutVerification(body);                // pre-verified / EventBridge
  const header = stripe.webhooks.generateTestHeaderString({payload, secret, timestamp?}); // tests
  ```

  `webhooks` is also available **statically** (`Stripe.webhooks`), so no API key is needed to verify webhooks.
- **Scheme:**
  - Header `t=<unix>,v1=<hex>[,v1=…][,v0=…][,secret=…,destination=…,payload=…]`.
  - Signed content: `` `${t}.${payload}` `` (`makeHMACContent`, L362), HMAC-SHA256 keyed with the `whsec_…` secret, hex output.
  - Only signatures matching `EXPECTED_SCHEME = 'v1'` are collected (`parseHeader`, L686). Any matching `v1` passes, which supports secret rotation, and every comparison goes through `platformFunctions.secureCompare` (constant time).
  - `DEFAULT_TOLERANCE: 300` (L152).
  - The timestamp check is `tolerance > 0 && now - t > tolerance` (L466). It rejects only *old* timestamps (not future ones), and `0` disables the check.
  - Docs, [docs.stripe.com/webhooks#verify-manually](https://docs.stripe.com/webhooks?verify=verify-manually): "Use a constant-time string comparison to compare the expected signature to every `v1` signature … ignore signature schemes other than `v1`" to prevent downgrade attacks. "Our libraries have a default tolerance of 5 minutes". When a secret is rolled, the old one can stay active for up to 7 days, with "one signature for each secret". "Don't use a tolerance value of `0`."
- **Diagnostics:** on mismatch, the error message compares the masked `secret=` and truncated `payload=` SHA-256 debug entries against the caller's inputs. It tells the user "wrong secret" or "body was modified" without ever trusting those entries for verification (L540–L660). It also detects a parsed object passed instead of the raw body (`invalid_payload_type`) and secrets containing whitespace.
- **Sync vs. async:** `CryptoProvider` has `computeHMACSignature` (sync) and `computeHMACSignatureAsync`. `SubtleCryptoProvider` supports async only, and its sync call raises `CryptoProviderOnlySupportsAsyncError`, which the SDK annotates with "Use `await constructEventAsync(...)`" ([`src/crypto/`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/crypto/)).
- **Test helper:** `generateTestHeaderString` / `generateTestHeaderStringAsync` build `t=${ts},v1=${hmac}` (`prepareOptions`, L729). See the README section "Testing Webhook signing".
- **v2 thin events / event notifications:**
  - `stripe.parseEventNotification(body, header, secret)` uses the same signature check, then builds an `EventNotification` (`object: 'v2.core.event'`) that gets `fetchEvent()` and `fetchRelatedObject()` closures ([`src/stripe.core.ts:L1638-L1705`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts#L1638)).
  - Those closures call through `withStripeContext(event.context)` and send `Stripe-Request-Trigger: event=<id>`. The path segment is `encodeURIComponent`'d because the id comes from remote data.
  - Passing a v2 payload to `constructEvent`, or a v1 payload to `parseEventNotification`, throws an error with a helpful message.
  - `stripe.notificationHandler(secret, fallback)` returns a typed router: `.on(type, cb)`, `.preHandle(cb)` (dedupe/logging), `.handle(body, sig)`. Registering after the first handled event throws. Unknown types go to the fallback with `{isKnownEventType}` ([`src/StripeEventNotificationHandler.ts:L463`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/StripeEventNotificationHandler.ts#L463)). The known-type set is a generated block.
  - Docs, [docs.stripe.com/events/manage-webhook-endpoints](https://docs.stripe.com/events/manage-webhook-endpoints): "Event notification handlers are the preferred approach to process thin events in production."

## 10. Typing

- **Generation:** types are produced from Stripe's OpenAPI spec (`OPENAPI_VERSION` = `v2596`) by the private `sdk-codegen` tool and emitted next to each resource class. The public part is the output plus the CONTRIBUTING banner convention. Since v22 they are real TS in `src/` instead of a separate `.d.ts` tree.
- **Namespace access:** `Stripe` is a class merged with `export declare namespace Stripe { … }` that re-exports every type (generated block `StripeInterfaceExports`, [`src/stripe.core.ts:L1851`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts#L1851)). Users write `Stripe.Customer`, `Stripe.CustomerCreateParams`, `Stripe.PaymentIntent.Status`, `Stripe.V2.Core.Account`. CJS needs a second duplicated namespace in `stripe.cjs.node.ts`, which is about 16.8k lines.
- **Expandable fields** are unions: `customer: string | Customer | DeletedCustomer | null` ([`src/resources/PaymentIntents.ts:L394`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/resources/PaymentIntents.ts#L394)). The README tells users to cast (`(pi.customer as Stripe.Customer).email`). No conditional types tie `expand: [...]` to the result.
- **Metadata:** `Metadata = {[name: string]: string}` on responses and `MetadataParam = {[name]: string | number | null}` on requests ([`src/shared.ts:L5`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/shared.ts#L5)). `Emptyable<T> = null | '' | T` covers v1's "unset with empty string".
- **Open enums:** `OtherString = string & Record<never, never>` is unioned into open enums so new server values type-check without breaking autocomplete ([`src/shared.ts:L191`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/shared.ts#L191); README "Open and Closed Enum").
- **Versioning of types** (README, "TypeScript and the stripe-node versioning policy"): types reflect only the pinned API version, and `StripeConfig.apiVersion` is typed as `LatestApiVersion`. Weakening a type, for example adding a response enum value, ships in a minor release.
- **v2 numerics:** `int64_string` fields map to `bigint` and `decimal_string` to `Stripe.Decimal`, driven by runtime `requestSchema` / `responseSchema` emitted per method ([`src/V2Coercion.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/V2Coercion.ts)).

## 11. Raw requests, uploads, binary downloads

- **`rawRequest`** ([`src/stripe.core.ts:L1330`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts#L1330), [`src/RequestSender.ts:L573`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/RequestSender.ts#L573)):

  ```ts
  const res = await stripe.rawRequest('POST', '/v1/beta_endpoint', {param: 123},
    {apiVersion: '2022-11-15; feature_beta=v3', additionalHeaders: {...}, apiBase: 'files'});
  ```

  Params are allowed on POST only (it throws otherwise, so GET params go in the path). It uses the same headers, retries and errors as generated methods and is tagged `usage: ['raw_request']`. `RawRequestOptions` adds `additionalHeaders` and `apiBase` ([`src/lib.ts:L174`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/lib.ts#L174)).
- **Multipart upload:**
  - `FileResource.requestDataProcessor = multipartRequestDataProcessor` ([`src/resources/Files.ts:L22`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/resources/Files.ts#L22)), plus `spec: {headers: {'Content-Type': 'multipart/form-data'}, apiBase: 'files'}`.
  - The body is built by hand as a `Uint8Array` ([`src/multipart.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/multipart.ts)). The boundary comes from a cryptographically secure UUID, and CR/LF are stripped from part names and filenames to prevent header injection.
  - The file param is `{data: string | Uint8Array (Buffer ok), name?, type?}` (`FileData`, [`src/lib.ts:L380`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/lib.ts#L380)).
  - Node can upload a readable stream (it is buffered first by `tryBufferData`); Web throws on streams.
- **Binary download:** `quotes.pdf(id)` uses `spec: {apiBase: 'files', streaming: true}` and returns `Promise<StripeStreamResponse>` ([`src/resources/Quotes.ts:L794`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/resources/Quotes.ts#L794)).
  - Under Node that is a `NodeJS.ReadableStream`. Under fetch it is the WHATWG `Response.body` (the type is still Node's; TODO DEVSDK-3112 targets the next major).
  - Error statuses (≥400) are still buffered and parsed as JSON errors (`options.streaming && res.getStatusCode() < 400`, [L752](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/RequestSender.ts#L752)).
  - The `response` event fires immediately for fetch, since fetch has no end-of-stream hook.

## 12. Testing, CI, release, docs

- **Framework:** Mocha 8 + Chai + chai-as-promised + nock, run in parallel, with TS via `ts-node/register/transpile-only` ([`.mocharc.js`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/.mocharc.js)). The repo uses Yarn classic and `just` ([`justfile`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/justfile)): `just test`, `just lint`, `just format`, `just types-test` (compiles `testProjects/types*`), `just integrations-test`, and `just ci-test` (all of them).
- **stripe-mock:** a Go mock server driven by the OpenAPI spec and fixtures. `getStripeMockClient()` forwards every request to `localhost:12111` through a custom `NodeHttpClient` ([`test/testUtils.ts`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/test/testUtils.ts)). [`test/resources/generated_examples_test.spec.js`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/test/resources/generated_examples_test.spec.js) is **generated**: one smoke test per documented API example, run against stripe-mock, plus nock-based tests for v2 error types (for example, `already_canceled` maps to `AlreadyCanceledError`). There are also hand-written unit specs (`RequestSender.spec.ts`, `autoPagination.spec.ts`, `Webhook.spec.ts`, `telemetry.spec.ts`, `net/*`, `crypto/*`), and `getTestServerStripe` spins up a real local `http.Server` for retry and timeout tests.
- **CI** ([`.github/workflows/main.yml`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/.github/workflows/main.yml)):
  - `Static Checks` job: `just lint-check` + `just format-check`.
  - `Test` job: Node 20/22/24 matrix, plus Windows. It starts stripe-mock with `openapi_version: $(< OPENAPI_VERSION)` and also sets up Deno ([`.github/actions/test/action.yml`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/.github/actions/test/action.yml)).
  - `Publish` job (on a `v*` tag, `environment: release`): `npm publish --tag latest|public-preview|private-preview`, with the tag derived from a `-beta` / `-alpha` version suffix. It uses **npm OIDC trusted publishing** (`id-token: write`, no stored token).
  - All actions are pinned by SHA, `persist-credentials: false`, and caches are disabled to reduce cache-poisoning risk. A `zizmor.yml` workflow audits Actions security.
  - `canary.yml` runs the same suite against code generated from canary specs on force-pushed `canary-*` branches, which are never released.
  - `changelog.yml` requires a `hark` change file on every PR.
  - `rules.yml` enforces squash auto-merge.
- **Changelog / release:**
  - Each PR adds `.hark/changes/<date>_<author>_<slug>.change.md` with front-matter `title`, `pr_url`, `semver_level` and a body ([example](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/.hark/changes/2026-11-06_jar_fix-event-fetch-helper-context-scoping.change.md)).
  - `hark build` generates `CHANGELOG.md` ("THIS IS A GENERATED FILE") and `.hark/releases.json`, which records `{version, released_on, pinned_api_version, minimum_runtime_version}` per release ([`.hark/releases.json`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/.hark/releases.json)). Migration guides live in `.hark/migration-guides/v23.md`.
  - `just update-version <v>` rewrites `VERSION`, `package.json` and `static PACKAGE_VERSION` in the entry files.
  - Codegen updates arrive as bot PRs titled "Update generated code", authored by `stripe-openapi`, each with a change file.
  - Version files: `VERSION` (23.1.0), `OPENAPI_VERSION` (v2596), `CODEGEN_VERSION` (generator commit). The API version is in `src/apiVersion.ts` (generated). There is **no** `API_VERSION` file any more. `just print-version-info` reads it out.
- **README structure:** Requirements → Installation → Usage (ESM, CJS, TS, `expand`, versioning policy, open enums, Deno) → Configuration (options table, timeout, Connect, proxy, retries, `lastResponse`, events, webhook signing and testing, undocumented params, plugins/`appInfo`, auto-pagination, telemetry, preview SDKs, `rawRequest`) → Support → Development ([`README.md`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/README.md)).
- **Generated vs. hand-written:** see §3 and [`CONTRIBUTING.md`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/CONTRIBUTING.md): "If your contribution involves changes to generated code … we will likely need to make a change to our code generator." The README notes external contributions from first-time contributors are on hiatus.

## 13. API version pinning per SDK major

- `src/apiVersion.ts` holds `ApiVersion = '2026-10-28.endive'` and `ApiMajorVersion = 'endive'`. This becomes `Stripe.API_VERSION`, and `Stripe.MAJOR_API_VERSION` is documented as "Objects retrieved using the same major version are compatible" ([`src/stripe.core.ts:L985-L993`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/src/stripe.core.ts#L985)).
- Every request sends `Stripe-Version`. v2 *requires* it ([api-v2-overview](https://docs.stripe.com/api-v2-overview): "All API requests to the API `/v2` namespace must include the `Stripe-Version` header").
- The cadence: named API majors (`dahlia` → `endive`) arrive about twice a year (March and September) with monthly minor releases. A new API major triggers a new SDK major (v21 dahlia, v23 endive), and a monthly minor triggers an SDK minor that re-pins (23.1.0 "changes the pinned API version to `2026-10-28.endive`"). SDK-only breaking changes can also force a major on the same API version (v22) ([`CHANGELOG.md`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/CHANGELOG.md), [`.hark/releases.json`](https://github.com/stripe/stripe-node/blob/6237106099542b8e0a3b52ef78308b3f678e93a6/.hark/releases.json)).
- Docs, [sdks/versioning](https://docs.stripe.com/sdks/versioning?lang=node): "Each SDK version uses the API version that is current at the time of its release to make API requests." Old majors get no fixes ("Older major versions … won't receive any additional updates").
- Overriding `apiVersion` is possible but untyped (README: use `// @ts-ignore stripe-version-…`). Preview features go in the version string (`'2022-08-01; feature_beta=v3'`), and preview channels ship as `-beta.N` / `-alpha.N` npm dist-tags.
- The user-supplied `apiVersion` is echoed back as `lastResponse.apiVersion` (from the `stripe-version` response header).

---

## Adopt / Adapt / Skip for teachmehipaa-node

| Stripe pattern | Verdict | TeachMeHIPAA mapping |
|---|---|---|
| TS core + `tsc` dual ESM/CJS, zero deps, conditional `exports` per runtime, `PlatformFunctions` seam | **Adapt** | Keep zero deps and the conditional exports. Prefer ESM-first with a CJS build from one tool (tsup/tsdown or dual `tsc`). Make the seam small: `fetch`, `crypto.subtle`, `randomUUID`, `TextEncoder`. Use **fetch everywhere** (Node 20+, Deno, Bun, Workers) instead of keeping a Node `http` client. Never copy-paste the core per entry (see the §1 drift). |
| `wintertc-compat` lint rule + `testProjects/` per runtime | **Adopt** | Same idea: forbid `node:*` in `src/` except `platform/node.ts`. Smoke-test Node 20/22/24, Bun, Deno and a Workers project in CI. |
| `new Stripe(key, config)`, config allowlist that throws on unknown keys | **Adapt** | `new TeachMeHipaa({clientId, clientSecret, environment: 'live'|'sandbox', baseUrl?, scopes?, timeout, maxRetries, fetch?, appInfo?})`. Validate config with a schema and throw on unknown keys. `environment` selects the live or sandbox base URL. Keep `baseUrl` for staging and mocks. |
| Static secret key → `Authorization: Bearer` via `RequestAuthenticator` hook run per attempt | **Adapt (core difference)** | Ship `ClientCredentialsAuth`: cache the 15-min JWT, refresh proactively (expiry minus about 60s skew), collapse concurrent refreshes into one in-flight promise, and on a **401 invalidate and retry once** (Stripe never does this). Ship `AuthorizationCodeAuth` (PKCE) with **rotating refresh tokens**. Persist the new refresh token atomically through a user-supplied `tokenStore` with an `onTokens` callback, and serialize refreshes, because a rotated token is single-use. Keep the `authenticator` escape hatch. **Fix Stripe's bug:** an authenticator rejection must reject the call (Stripe's leaks as an unhandled rejection). |
| Resource classes extending a base with one `_makeRequest(method, path, params, options, spec)` primitive; generated files with a banner and fenced blocks | **Adopt** | Generate from our OpenAPI 3.1 spec with a **public, in-repo** generator script (not private like Stripe's). Keep the `// generated` banner and fences, and a CI check that regenerating produces no diff. One resource per file, with types co-located. |
| Method naming `create/retrieve/update/list/del` + custom verbs on the resource | **Adapt** | Use `create/get/update/list/delete` (modern TS has no `del` constraint). AIP-136 `POST …/enrollments/{id}:cancel` becomes `client.organizations.enrollments.cancel(orgId, id, params?, options?)`. The generator maps the `:verb` suffix to a method name, and the `:` stays unescaped in the path while ids are `encodeURIComponent`'d. |
| v1 flattened sub-resources vs. v2 nested sub-resources | **Adopt v2 style** | Nest: `client.organizations.enrollments.list(orgId)`. Optionally offer an `client.forOrganization(orgId)` scoped client (modelled on `withStripeContext`) so `orgId` isn't repeated. |
| Params first, `RequestOptions` last and never merged | **Adopt** | `RequestOptions = {idempotencyKey, ifMatch, timeout, maxRetries, headers, signal, apiVersion?}`. Add `signal` (`AbortSignal`), which Stripe lacks. |
| `lastResponse` non-enumerable metadata | **Adapt** | Expose `withResponse()` / `.asResponse()` returning `{data, response: {status, headers, requestId, etag}}`. **ETag** is first-class: surface `etag`, and accept `ifMatch` / `ifNoneMatch` in options. A 412 maps to `PreconditionFailedError` and a 304 to a typed not-modified result. |
| `ApiListPromise` = Promise + AsyncIterator + `autoPagingEach` / `autoPagingToArray({limit})` | **Adopt (trimmed)** | Return a `PagePromise<T>` that awaits to one page and supports `for await` over items. Add a `.pages()` iterator and `toArray({limit})` with a hard cap. Skip the callback form of `autoPagingEach`. Iterate on our **opaque cursor** (`next_cursor` / `pageToken`), like Stripe's v2 `next_page_url`, not Stripe v1's `starting_after = last.id`. Keep the "concurrent `next()` dedupe" fix. |
| Error mapping by status/body; `StripeError` with `type, code, statusCode, requestId, headers, raw` | **Adapt** | Parse **RFC 9457 problem+json** (`type` URI, `title`, `status`, `detail`, `instance`, extensions). Base `TeachMeHipaaError` gets `status, type, title, detail, instance, requestId, headers, raw, errors?` (field violations). Map subclasses by status (400 `InvalidRequest`, 401 `Authentication`, 403 `Permission`, 404 `NotFound`, 409 `Conflict`, 412 `PreconditionFailed`, 422 `Validation`, 429 `RateLimit`, 5xx `Api`), then refine by a generated switch on the problem `type` URI (as in Stripe's v2 switch). Add `ConnectionError`, `TimeoutError`, `OAuthError` (RFC 6749 codes, cf. `generateOAuthError`) and `SignatureVerificationError`. Use `type` = class name so it survives minification. |
| Retry: 2 retries, `0.5s·2^n` (max 5s), 50–100% jitter, retry on connection errors/409/5xx, `Stripe-Should-Retry` | **Adapt** | Same backoff. Retry on connection errors, 408, 409 (only for idempotency in-flight conflicts), 429 and 5xx. **Honor `Retry-After`** (seconds or HTTP-date, capped), which Stripe dropped and we need for 429. Optionally define our own `X-Should-Retry`. Never retry non-idempotent requests that lack a key. Keep the "retry ECONNRESET once" rule. |
| Auto `Idempotency-Key` (uuid4) on POST/DELETE, generated once and reused across retries | **Adopt** | Key every POST, including AIP-136 custom methods. Stripe v2 also keys DELETE; PATCH needs a decision. Prefix the key `tmh-node-retry-`. A user key overrides it. |
| AIP-151 long-running operations | **New (no Stripe analogue)** | Return an `Operation<T>` with `.poll()`, `.wait({timeout, signal, pollInterval})` that uses backoff and `Retry-After`, `.done`, `.result` and `.error` (problem+json). Add `client.operations.get(name)` and `client.operations.wait(name)`. |
| `HttpClient` interface + `request`/`response` events + `emitEventBodies` off by default | **Adapt** | Use a minimal `fetch`-compatible injection (`fetch?: typeof fetch`) instead of a bespoke interface. Replace the emitter with typed hooks (`onRequest`, `onResponse`, `onRetry`, `onError`) or an optional `logger`. **Never log bodies or `Authorization` by default** (HIPAA/PHI). Redact by default. |
| `User-Agent: TeachMeHipaa/… NodeBindings/x` + `X-Stripe-Client-User-Agent` JSON + `appInfo` | **Adapt** | `User-Agent: teachmehipaa-node/<ver> (<runtime>/<ver>; <os>) <appInfo>` plus an `X-TMH-Client` JSON header without hostnames. Keep `appInfo` for integrators. |
| `X-Stripe-Client-Telemetry` latency piggyback, on-disk telemetry ID, AI-agent detection, stderr hint | **Skip** | Not justified for a compliance product. If ever added, make it opt-in. |
| Webhooks: `constructEvent` / `constructEventAsync`, HMAC-SHA256 over `t.payload`, multi-`v1` rotation, 300s tolerance, constant-time compare, `generateTestHeaderString`, static (no key needed) | **Adopt** | Define a mirror header, `TMH-Signature: t=…,v1=…`. Prefer async-only verification on `crypto.subtle`, which works on every runtime, with a Node sync variant only if needed. **Reject future timestamps beyond the tolerance too** (Stripe checks only age). Keep the diagnostic error messages ("did you pass the parsed body?"). Ship `generateTestHeader()` and a typed `webhooks.on(type, handler)` router modelled on `notificationHandler` (with `preHandle` for dedupe). |
| Thin events (`fetchEvent` / `fetchRelatedObject`) | **Adapt if our payloads are thin** | If we send minimal payloads plus the resource URL, copy the `fetchRelatedObject()` pattern, encoding ids that come from remote data. |
| `rawRequest(method, path, params, options)` | **Adopt** | `client.request<T>({method, path, query, body, options})`. Allow query on GET (Stripe forbids it). Same auth, retry and error stack. |
| Multipart builder | **Skip unless we upload** | If needed, use native `FormData` + `Blob` (fetch-native on every target), not a hand-rolled buffer builder. |
| Binary download returning `NodeJS.ReadableStream` (`streaming: true`) | **Adapt** | `certificates.downloadPdf(id)` returns a `BinaryResponse` with `.body: ReadableStream<Uint8Array>`, `.arrayBuffer()`, `.blob()`, `contentType`, `contentDisposition`, `etag`. Parse error statuses as problem+json, as Stripe does. Release the timeout once streaming starts (Stripe's fetch fix). |
| Types inline in TS, `Client.Namespace` type re-exports, open enums via `OtherString`, expandables as unions | **Adapt** | Generate types from OpenAPI 3.1 (possibly Zod schemas for runtime validation, optional). Export as named types (`import type {Enrollment} from 'teachmehipaa'`) rather than a merged class+namespace, which forces Stripe to duplicate a 16k-line CJS namespace. Keep the open-enum trick. We have no `expand`, so skip expandable unions. |
| One pinned API version per SDK major (`apiVersion.ts`, `Stripe-Version` header) | **Adapt** | If our API is URL-versioned (`/v1`), pin the base path per SDK major and send an `TMH-API-Version` date header only if the server supports dated versions. Record `{sdkVersion, apiVersion, minNode}` per release (as in `releases.json`). |
| stripe-mock + generated example tests; hand-written unit tests against a local `http.Server` | **Adapt** | Run Prism (or our own mock) from our OpenAPI 3.1 spec in CI, generate one smoke test per operation, and use Vitest with `msw` / an injected fetch for retry, auth-refresh and LRO tests. |
| `hark` change files → generated CHANGELOG, migration guides, OIDC npm publish on tag, dist-tags for beta/alpha | **Adapt** | Use Changesets (the same idea, public). npm trusted publishing (OIDC) with provenance, SHA-pinned actions, `persist-credentials: false`, and a zizmor-style Actions audit. `-beta` → `next` dist-tag. |
| Callbacks, `Stripe(key)` callable without `new`, string-as-apiVersion config, params/options mixing | **Skip** | Legacy baggage that Stripe spent v22 removing. |
