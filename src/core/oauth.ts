import {
  resolveTokenEndpoint,
  type Environment,
  type TokenEndpointOptions,
} from "./config.js";
import { exchangeGrant, type GrantTokens } from "./grant-exchange.js";

/** A PKCE code verifier and the challenge to put on the consent URL. */
export interface PkcePair {
  /** Keep this server-side until the code exchange; never send it to the browser. */
  readonly codeVerifier: string;
  readonly codeChallenge: string;
  /** The only method TeachMeHIPAA accepts. */
  readonly method: "S256";
}

const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

// 32 bytes encode to 43 base64url characters: the shortest verifier RFC 7636
// allows, carrying the full 256 bits it recommends.
const randomToken = (): string =>
  base64url(crypto.getRandomValues(new Uint8Array(32)));

const createPkcePair = async (): Promise<PkcePair> => {
  const codeVerifier = randomToken();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  return {
    codeVerifier,
    codeChallenge: base64url(new Uint8Array(digest)),
    method: "S256",
  };
};

/** A random `state` to bind the consent redirect to the admin's session. */
const createState = (): string => randomToken();

// The Sandbox console's consent URL is not published yet, so Sandbox callers
// pass `authorizationUrl` rather than the SDK guessing a host.
const AUTHORIZATION_URLS: Readonly<Record<Environment, string | undefined>> = {
  live: "https://console.teachmehipaa.com/oauth/authorize",
  sandbox: undefined,
};

export interface AuthorizeUrlParams {
  /** Your Partner app's id (`app_…`). */
  readonly clientId: string;
  /** One of the app's registered redirect URIs, matched exactly. */
  readonly redirectUri: string;
  /** The Scopes to ask the admin for. */
  readonly scopes: readonly string[];
  /**
   * Echoed back on the redirect. Check it matches before exchanging the
   * code; `createState()` makes one.
   */
  readonly state: string;
  /** From `createPkcePair()`. */
  readonly codeChallenge: string;
  /** Defaults to `live`. */
  readonly environment?: Environment;
  /** Overrides the Environment's consent URL. */
  readonly authorizationUrl?: string;
}

const invalid = (message: string): TypeError =>
  new TypeError(`TeachMeHipaa.oauth: ${message}`);

const requireText = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw invalid(`${name} must be a non-empty string`);
  }
  return value;
};

const consentBaseUrl = (params: AuthorizeUrlParams): string => {
  if (params.authorizationUrl !== undefined) {
    if (!URL.canParse(params.authorizationUrl)) {
      throw invalid("authorizationUrl must be an absolute URL");
    }
    return params.authorizationUrl;
  }
  const environment = params.environment ?? "live";
  const url = AUTHORIZATION_URLS[environment];
  if (url === undefined) {
    throw invalid(
      `pass authorizationUrl: the ${environment} consent URL is not built in`,
    );
  }
  return url;
};

/** The URL to send an Organization admin to, to grant your app access. */
const authorizeUrl = (params: AuthorizeUrlParams): string => {
  const url = new URL(consentBaseUrl(params));
  const query = new URLSearchParams({
    response_type: "code",
    client_id: requireText(params.clientId, "clientId"),
    redirect_uri: requireText(params.redirectUri, "redirectUri"),
    scope: params.scopes.join(" "),
    // Without state, a forged redirect could attach an attacker's Grant to
    // the partner's session (RFC 6749 §10.12), so it is never optional.
    state: requireText(params.state, "state"),
    code_challenge: requireText(params.codeChallenge, "codeChallenge"),
    code_challenge_method: "S256",
  });
  // Form encoding writes spaces as `+`, which only form parsers read back.
  url.search = query.toString().replace(/\+/g, "%20");
  return url.toString();
};

export interface ExchangeCodeParams extends TokenEndpointOptions {
  /** Your Partner app's id (`app_…`). */
  readonly clientId: string;
  /** Your Partner app's secret (`tmh_as_…`). */
  readonly clientSecret: string;
  /** The `code` from the redirect. It works once, within 10 minutes. */
  readonly code: string;
  /** The same redirect URI the consent URL carried. */
  readonly redirectUri: string;
  /** The verifier from the `createPkcePair()` behind the consent URL. */
  readonly codeVerifier: string;
}

const CODE_EXCHANGE_GUIDANCE = {
  connection:
    "The code exchange was not retried: the code may have been consumed, and a code works only once. Re-run consent to get a new code.",
};

/**
 * Exchanges the redirect's code for the Grant's first tokens. Save the
 * Refresh token in your token store before you use the Access token.
 */
const exchangeCode = async (
  params: ExchangeCodeParams,
): Promise<GrantTokens> => {
  const grant = await exchangeGrant(
    resolveTokenEndpoint(params),
    {
      clientId: requireText(params.clientId, "clientId"),
      clientSecret: requireText(params.clientSecret, "clientSecret"),
    },
    new URLSearchParams({
      grant_type: "authorization_code",
      code: requireText(params.code, "code"),
      redirect_uri: requireText(params.redirectUri, "redirectUri"),
      code_verifier: requireText(params.codeVerifier, "codeVerifier"),
    }),
    CODE_EXCHANGE_GUIDANCE,
  );
  return {
    accessToken: grant.accessToken,
    refreshToken: grant.refreshToken,
    expiresIn: grant.expiresIn,
    scopes: grant.scopes,
  };
};

/** Helpers for connecting Organizations to a Partner app. */
export const oauth = Object.freeze({
  createPkcePair,
  createState,
  authorizeUrl,
  exchangeCode,
});
