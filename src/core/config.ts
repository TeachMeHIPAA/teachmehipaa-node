import { systemClock, type Clock } from "./clock.js";
import { withRequestLogging, type Logger } from "./logging.js";
import type { TokenProvider } from "./token-provider.js";
import { fetchTransport, type Transport } from "./transport.js";
import { optionsValidator } from "./usage.js";
import { buildUserAgent, type AppInfo } from "./user-agent.js";

export type Environment = "live" | "sandbox";

export const ENVIRONMENT_BASE_URLS: Readonly<Record<Environment, string>> = {
  live: "https://api.tme.so/v1",
  sandbox: "https://api-teachmehipaa-dev.web.app/v1",
};

interface SharedClientOptions {
  /**
   * Which TeachMeHIPAA deployment your credentials belong to. Defaults to
   * `live`; Sandbox credentials never work against Live.
   */
  readonly environment?: Environment;
  /** Overrides the Environment's base URL, e.g. to point at a mock server. */
  readonly baseUrl?: string;
  /**
   * The Organization to act for. When omitted, the client looks it up once
   * from the Access token.
   */
  readonly organizationId?: string;
  /** Retries for a failed request that is safe to replay. Defaults to 2. */
  readonly maxRetries?: number;
  /** Milliseconds to wait for each response. Defaults to 80 000. */
  readonly timeout?: number;
  /** Your software's name, version and URL, sent in the User-Agent. */
  readonly appInfo?: AppInfo;
  /**
   * A `fetch` to send requests with, e.g. one with a proxy dispatcher.
   * Defaults to the global `fetch`. Give this or `transport`, not both.
   */
  readonly fetch?: typeof fetch;
  /**
   * Replaces the HTTP layer entirely, e.g. with a fake in tests. Give this or
   * `fetch`, not both.
   */
  readonly transport?: Transport;
  /**
   * Opt-in request logging: method, path, status, latency and request id.
   * Bodies and credentials are never logged.
   */
  readonly logger?: Logger;
  /** Supplies the current time and sleeps. For tests; defaults to real time. */
  readonly clock?: Clock;
}

/** Authenticate with an API client's own credentials. */
export interface ClientCredentialsOptions extends SharedClientOptions {
  /** Your API client's id (`cli_…`). */
  readonly clientId: string;
  /** Your API client's secret (`tmh_cs_…`). */
  readonly clientSecret: string;
  /**
   * The Scopes to request, such as `learners:write`. Defaults to every Scope
   * the API client holds.
   */
  readonly scopes?: readonly string[];
  readonly tokenProvider?: never;
}

/** Authenticate with Access tokens you obtained elsewhere. */
export interface TokenProviderOptions extends SharedClientOptions {
  /**
   * Supplies every Access token, e.g. `staticTokenProvider(...)`. Give this
   * or `clientId` and `clientSecret`.
   */
  readonly tokenProvider: TokenProvider;
  readonly clientId?: never;
  readonly clientSecret?: never;
  readonly scopes?: never;
}

/**
 * No credentials: only public methods (`courses.*`,
 * `certificateVerifications.retrieve`) work, and any other call fails before
 * it sends anything.
 */
export interface PublicClientOptions extends SharedClientOptions {
  readonly clientId?: never;
  readonly clientSecret?: never;
  readonly scopes?: never;
  readonly tokenProvider?: never;
}

export type ClientOptions =
  ClientCredentialsOptions | TokenProviderOptions | PublicClientOptions;

/** How the client gets Access tokens. */
export type ResolvedAuth =
  | {
      readonly kind: "clientCredentials";
      readonly clientId: string;
      readonly clientSecret: string;
      readonly scopes: readonly string[] | undefined;
    }
  | { readonly kind: "tokenProvider"; readonly tokenProvider: TokenProvider }
  | { readonly kind: "none" };

export interface ResolvedConfig {
  readonly auth: ResolvedAuth;
  readonly baseUrl: string;
  readonly organizationId: string | undefined;
  readonly maxRetries: number;
  readonly timeout: number;
  readonly userAgent: string;
  readonly transport: Transport;
  readonly clock: Clock;
}

const KNOWN_OPTIONS: ReadonlySet<string> = new Set<
  keyof ClientCredentialsOptions | keyof TokenProviderOptions
>([
  "clientId",
  "clientSecret",
  "tokenProvider",
  "environment",
  "baseUrl",
  "organizationId",
  "scopes",
  "maxRetries",
  "timeout",
  "appInfo",
  "fetch",
  "transport",
  "logger",
  "clock",
]);

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 80_000;

const { invalid, requireNonEmptyString } = optionsValidator();

const optionalNonEmptyString = (
  value: unknown,
  name: string,
): string | undefined =>
  value === undefined ? undefined : requireNonEmptyString(value, name);

const trimTrailingSlashes = (url: string): string => url.replace(/\/+$/, "");

const resolveBaseUrl = (environment: unknown, baseUrl: unknown): string => {
  if (
    environment !== undefined &&
    environment !== "live" &&
    environment !== "sandbox"
  ) {
    throw invalid('environment must be "live" or "sandbox"');
  }
  if (baseUrl === undefined) {
    return ENVIRONMENT_BASE_URLS[environment ?? "live"];
  }
  if (typeof baseUrl !== "string" || !URL.canParse(baseUrl)) {
    throw invalid("baseUrl must be an absolute URL");
  }
  return trimTrailingSlashes(baseUrl);
};

const resolveScopes = (value: unknown): readonly string[] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((s) => typeof s !== "string")) {
    throw invalid("scopes must be an array of strings");
  }
  return Object.freeze([...(value as readonly string[])]);
};

const resolveMaxRetries = (value: unknown): number => {
  if (value === undefined) {
    return DEFAULT_MAX_RETRIES;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw invalid("maxRetries must be a non-negative integer");
  }
  return value;
};

const resolveTimeout = (value: unknown): number => {
  if (value === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw invalid("timeout must be a positive number of milliseconds");
  }
  return value;
};

const resolveTransport = (
  fetchImpl: unknown,
  transport: unknown,
): Transport => {
  if (fetchImpl !== undefined && transport !== undefined) {
    throw invalid("give either fetch or transport, not both");
  }
  if (fetchImpl !== undefined && typeof fetchImpl !== "function") {
    throw invalid("fetch must be a function");
  }
  if (transport !== undefined && typeof transport !== "function") {
    throw invalid("transport must be a function");
  }
  return (
    (transport as Transport | undefined) ??
    fetchTransport(fetchImpl as typeof fetch | undefined)
  );
};

const resolveLogger = (value: unknown): Logger | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as Partial<Logger>).debug !== "function"
  ) {
    throw invalid("logger must have a debug(message, fields) method");
  }
  return value as Logger;
};

const resolveAppInfo = (value: unknown): AppInfo | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "object" || value === null) {
    throw invalid("appInfo must be an object with a name");
  }
  const { name, version, url } = value as Record<string, unknown>;
  return {
    name: requireNonEmptyString(name, "appInfo.name"),
    ...(version === undefined
      ? {}
      : { version: requireNonEmptyString(version, "appInfo.version") }),
    ...(url === undefined
      ? {}
      : { url: requireNonEmptyString(url, "appInfo.url") }),
  };
};

const resolveTokenProvider = (value: unknown): TokenProvider => {
  const provider = value as Partial<TokenProvider> | null;
  if (
    typeof provider?.getAccessToken !== "function" ||
    typeof provider.invalidate !== "function"
  ) {
    throw invalid(
      "tokenProvider must have getAccessToken() and invalidate(accessToken) methods",
    );
  }
  return provider as TokenProvider;
};

const resolveAuth = (options: ClientOptions): ResolvedAuth => {
  // Only a caller who gave no credential at all gets a public client; half a
  // pair is a mistake, so it still fails here.
  const credentials = [
    options.tokenProvider,
    options.clientId,
    options.clientSecret,
    options.scopes,
  ];
  if (credentials.every((value) => value === undefined)) {
    return { kind: "none" };
  }
  if (options.tokenProvider === undefined) {
    return {
      kind: "clientCredentials",
      clientId: requireNonEmptyString(options.clientId, "clientId"),
      clientSecret: requireNonEmptyString(options.clientSecret, "clientSecret"),
      scopes: resolveScopes(options.scopes),
    };
  }
  // The types forbid mixing them, but JavaScript callers aren't checked.
  const conflicting = Object.entries(options)
    .filter(
      ([name, value]) =>
        ["clientId", "clientSecret", "scopes"].includes(name) &&
        value !== undefined,
    )
    .map(([name]) => name);
  if (conflicting.length > 0) {
    throw invalid(
      `give either tokenProvider or clientId and clientSecret, not both (got ${conflicting.join(", ")} too; scopes belong to the token provider)`,
    );
  }
  return {
    kind: "tokenProvider",
    tokenProvider: resolveTokenProvider(options.tokenProvider),
  };
};

/** Validates options once and copies them, so later edits have no effect. */
export const resolveConfig = (options: ClientOptions): ResolvedConfig => {
  const unknown = Object.keys(options).filter((key) => !KNOWN_OPTIONS.has(key));
  if (unknown.length > 0) {
    throw invalid(`unknown option(s): ${unknown.join(", ")}`);
  }
  const clock = options.clock ?? systemClock;
  const transport = resolveTransport(options.fetch, options.transport);
  const logger = resolveLogger(options.logger);
  const auth = resolveAuth(options);
  return Object.freeze({
    auth,
    baseUrl: resolveBaseUrl(options.environment, options.baseUrl),
    organizationId: optionalNonEmptyString(
      options.organizationId,
      "organizationId",
    ),
    maxRetries: resolveMaxRetries(options.maxRetries),
    timeout: resolveTimeout(options.timeout),
    userAgent: buildUserAgent(resolveAppInfo(options.appInfo)),
    transport:
      logger === undefined
        ? transport
        : withRequestLogging(transport, logger, clock),
    clock,
  });
};
