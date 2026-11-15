import type { Clock } from "./clock.js";
import { oauthErrorFromResponse, readBody } from "./problem.js";
import type { Transport } from "./transport.js";

/**
 * Supplies the Access token for each request. Client credentials is the
 * default adapter; partner Grants and static tokens plug in here too.
 */
export interface TokenProvider {
  getAccessToken(): Promise<string>;
}

export interface ClientCredentialsSettings {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly scopes: readonly string[] | undefined;
  readonly tokenUrl: string;
  readonly userAgent: string;
  readonly transport: Transport;
  readonly timeout: number;
  readonly clock: Clock;
}

const isTokenResponse = (
  value: unknown,
): value is { readonly access_token: string; readonly expires_in: number } =>
  typeof value === "object" &&
  value !== null &&
  "access_token" in value &&
  typeof value.access_token === "string" &&
  "expires_in" in value &&
  typeof value.expires_in === "number";

interface CachedToken {
  readonly accessToken: string;
  readonly expiresAt: number;
}

const REMINT_MARGIN_MS = 60_000;

// RFC 6749 §2.3.1: Basic credentials are form-encoded before base64.
const basicCredentials = (clientId: string, clientSecret: string): string =>
  btoa(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`);

export const clientCredentialsTokenProvider = (
  settings: ClientCredentialsSettings,
): TokenProvider => {
  const form = new URLSearchParams({ grant_type: "client_credentials" });
  // Omitting scope grants every Scope the API client holds.
  if (settings.scopes !== undefined && settings.scopes.length > 0) {
    form.set("scope", settings.scopes.join(" "));
  }

  const mint = async (): Promise<CachedToken> => {
    // Expiry counts from when the request left, so a slow response can't
    // stretch the token past its real lifetime.
    const requestedAt = settings.clock.now();
    const response = await settings.transport({
      method: "POST",
      url: settings.tokenUrl,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${basicCredentials(settings.clientId, settings.clientSecret)}`,
        accept: "application/json",
        "user-agent": settings.userAgent,
      },
      body: form.toString(),
      timeout: settings.timeout,
    });
    const body = await readBody(response);
    if (!response.ok || !isTokenResponse(body.value)) {
      throw oauthErrorFromResponse(response, body);
    }
    const token = body.value;
    return {
      accessToken: token.access_token,
      expiresAt: requestedAt + token.expires_in * 1000,
    };
  };

  let current: CachedToken | undefined;
  let inFlight: Promise<CachedToken> | undefined;

  const isFresh = (token: CachedToken): boolean =>
    settings.clock.now() < token.expiresAt - REMINT_MARGIN_MS;

  return {
    async getAccessToken() {
      if (current !== undefined && isFresh(current)) {
        return current.accessToken;
      }
      inFlight ??= mint().finally(() => {
        inFlight = undefined;
      });
      current = await inFlight;
      return current.accessToken;
    },
  };
};
