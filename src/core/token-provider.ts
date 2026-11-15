import type { Clock } from "./clock.js";
import { TeachMeHipaaError } from "./errors.js";
import {
  connectionError,
  oauthErrorFromResponse,
  readBody,
} from "./problem.js";
import { serverDelay, withRetries, type Attempt } from "./retry.js";
import type { Transport } from "./transport.js";
import { usageError } from "./usage.js";

/**
 * Supplies the Access token for each request. Client credentials is the
 * default adapter; partner Grants and static tokens plug in here too.
 */
export interface TokenProvider {
  /** Rejects with the mint's error, which the caller's call then raises. */
  getAccessToken(): Promise<string>;
  /**
   * Called after the API answered 401 to `accessToken`. Forget it if it is
   * still the cached one, so the next `getAccessToken` mints afresh; a token
   * that was already replaced is left alone, so concurrent 401s mint once.
   */
  invalidate(accessToken: string): void;
  /**
   * The base URL this provider gets Access tokens from, when it has one. The
   * client refuses a provider whose base URL differs from its own.
   */
  readonly baseUrl?: string;
}

/** Where and how the client talks to the OAuth token endpoint. */
export interface TokenEndpoint {
  readonly tokenUrl: string;
  readonly userAgent: string;
  readonly transport: Transport;
  readonly timeout: number;
  readonly clock: Clock;
}

export interface TokenResponse {
  readonly access_token: string;
  readonly expires_in: number;
  readonly [field: string]: unknown;
}

export interface TokenExchange {
  readonly token: TokenResponse;
  /** When the request left, so expiry can't stretch past the real lifetime. */
  readonly requestedAt: number;
}

const isTokenResponse = (value: unknown): value is TokenResponse =>
  typeof value === "object" &&
  value !== null &&
  "access_token" in value &&
  typeof value.access_token === "string" &&
  "expires_in" in value &&
  typeof value.expires_in === "number";

const isNetworkOrServerFailure = (error: TeachMeHipaaError): boolean =>
  error.status === null || error.status >= 500;

/**
 * POSTs one grant to the token endpoint. `maxRetries` must be 0 for
 * `refresh_token` and `authorization_code` grants: replaying a consumed code
 * or Refresh token revokes the whole Grant (ADR-0004). Only
 * `client_credentials`, which mints a fresh token each time, may retry.
 */
export const exchangeAtTokenEndpoint = (
  endpoint: TokenEndpoint,
  form: URLSearchParams,
  authorization: string,
  maxRetries: number,
): Promise<TokenExchange> => {
  const attempt = async (): Promise<Attempt<TokenExchange>> => {
    const requestedAt = endpoint.clock.now();
    const received = await endpoint
      .transport({
        method: "POST",
        url: endpoint.tokenUrl,
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          authorization,
          accept: "application/json",
          "user-agent": endpoint.userAgent,
        },
        body: form.toString(),
        timeout: endpoint.timeout,
      })
      .then(async (response) => ({ response, body: await readBody(response) }))
      .catch((cause: unknown) => connectionError(cause, endpoint.timeout));
    if (received instanceof TeachMeHipaaError) {
      return { ok: false, error: received };
    }
    const { response, body } = received;
    if (!response.ok || !isTokenResponse(body.value)) {
      return {
        ok: false,
        error: oauthErrorFromResponse(response, body, endpoint.clock.now()),
      };
    }
    return { ok: true, value: { token: body.value, requestedAt } };
  };
  return withRetries(attempt, {
    maxRetries,
    clock: endpoint.clock,
    delayBeforeRetry: (error, retryNumber) =>
      isNetworkOrServerFailure(error)
        ? serverDelay(error, retryNumber, endpoint.clock.now())
        : null,
  });
};

export interface ClientCredentialsSettings extends TokenEndpoint {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly scopes: readonly string[] | undefined;
  readonly maxRetries: number;
}

/** An Access token and when it stops working, in clock milliseconds. */
export interface CachedToken {
  readonly accessToken: string;
  readonly expiresAt: number;
}

const REMINT_MARGIN_MS = 60_000;

/**
 * The caching every minting provider shares: re-mint 60 s before expiry,
 * one mint in flight at a time, and forget a token the API rejected.
 */
export const cachingTokenProvider = (
  mint: () => Promise<CachedToken>,
  clock: Clock,
): TokenProvider => {
  let current: CachedToken | undefined;
  let inFlight: Promise<CachedToken> | undefined;

  const isFresh = (token: CachedToken): boolean =>
    clock.now() < token.expiresAt - REMINT_MARGIN_MS;

  return {
    async getAccessToken() {
      if (current !== undefined && isFresh(current)) {
        return current.accessToken;
      }
      inFlight ??= mint()
        .then((token) => (current = token))
        .finally(() => {
          inFlight = undefined;
        });
      return (await inFlight).accessToken;
    },
    invalidate(accessToken) {
      if (current?.accessToken === accessToken) {
        current = undefined;
      }
    },
  };
};

// RFC 6749 §2.3.1: Basic credentials are form-encoded before base64.
export const basicAuthorization = (
  clientId: string,
  clientSecret: string,
): string =>
  `Basic ${btoa(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`)}`;

export const clientCredentialsTokenProvider = (
  settings: ClientCredentialsSettings,
): TokenProvider => {
  const form = new URLSearchParams({ grant_type: "client_credentials" });
  // Omitting scope grants every Scope the API client holds.
  if (settings.scopes !== undefined && settings.scopes.length > 0) {
    form.set("scope", settings.scopes.join(" "));
  }
  const authorization = basicAuthorization(
    settings.clientId,
    settings.clientSecret,
  );
  return cachingTokenProvider(async () => {
    const { token, requestedAt } = await exchangeAtTokenEndpoint(
      settings,
      form,
      authorization,
      settings.maxRetries,
    );
    return {
      accessToken: token.access_token,
      expiresAt: requestedAt + token.expires_in * 1000,
    };
  }, settings.clock);
};

/**
 * Sends an Access token you obtained yourself, as is. It is never renewed:
 * once it expires or is revoked, calls raise `AuthenticationError`.
 */
export const staticTokenProvider = (accessToken: string): TokenProvider => {
  if (typeof accessToken !== "string" || accessToken.trim() === "") {
    throw usageError("staticTokenProvider needs a non-empty Access token");
  }
  return {
    getAccessToken: () => Promise.resolve(accessToken),
    invalidate: () => undefined,
  };
};
