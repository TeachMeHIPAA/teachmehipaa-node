import { resolveTokenEndpoint, type TokenEndpointOptions } from "./config.js";
import { exchangeGrant } from "./grant-exchange.js";
import {
  cachingTokenProvider,
  type CachedToken,
  type TokenProvider,
} from "./token-provider.js";

/**
 * Where a Grant's Refresh token lives between processes, such as a database
 * row or a secrets manager. Every exchange replaces the Refresh token, and
 * presenting a replaced one revokes the Grant, so `save` must persist durably
 * before it resolves.
 */
export interface TokenStore {
  /** The Grant's current Refresh token, read once at the first exchange. */
  load(): Promise<string> | string;
  /** Persist the Refresh token that replaces the current one. */
  save(refreshToken: string): Promise<void> | void;
}

export interface PartnerGrantOptions extends TokenEndpointOptions {
  /** Your Partner app's id (`app_…`). */
  readonly clientId: string;
  /** Your Partner app's secret (`tmh_as_…`). */
  readonly clientSecret: string;
  /** Receives every rotated Refresh token before its Access token is used. */
  readonly tokenStore: TokenStore;
  /**
   * The Refresh token for the first exchange, e.g. straight from
   * `exchangeCode`. When omitted, the first exchange loads it from
   * `tokenStore`.
   */
  readonly refreshToken?: string;
  /** Narrows the Access token to these Scopes; it can never widen them. */
  readonly scopes?: readonly string[];
}

const invalid = (message: string): TypeError =>
  new TypeError(`TeachMeHipaa: partnerGrantTokenProvider ${message}`);

const requireText = (value: unknown, name: string): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw invalid(`needs ${name} as a non-empty string`);
  }
  return value;
};

const requireTokenStore = (value: unknown): TokenStore => {
  const store = value as Partial<TokenStore> | null | undefined;
  if (typeof store?.load !== "function" || typeof store.save !== "function") {
    throw invalid("needs a tokenStore with load() and save(refreshToken)");
  }
  return store as TokenStore;
};

const REFRESH_GUIDANCE = {
  connection:
    "The Refresh token exchange was not retried, because replaying a Refresh token the endpoint may already have rotated revokes the Grant. If the next call fails with invalid_grant, re-run consent for this Organization.",
  invalidGrant:
    "The Grant was revoked, or its Refresh token was reused (presenting a superseded Refresh token revokes the Grant). Re-run consent to connect the Organization again.",
};

const saveFailed = (cause: unknown): Error =>
  new Error(
    "TeachMeHipaa: tokenStore.save() failed, so the new Access token was not used. Until a save succeeds, your store holds a superseded Refresh token, and exchanging it would revoke the Grant.",
    { cause },
  );

/**
 * Access tokens for one Grant, from its Refresh token. Create one provider
 * per Grant and share it between clients: its lock is what keeps two
 * exchanges of the same Refresh token from racing (ADR-0004).
 */
export const partnerGrantTokenProvider = (
  options: PartnerGrantOptions,
): TokenProvider => {
  const credentials = {
    clientId: requireText(options.clientId, "clientId"),
    clientSecret: requireText(options.clientSecret, "clientSecret"),
  };
  const tokenStore = requireTokenStore(options.tokenStore);
  const endpoint = resolveTokenEndpoint(options);
  const scope = options.scopes?.join(" ") ?? "";
  let latest =
    options.refreshToken === undefined
      ? undefined
      : requireText(options.refreshToken, "refreshToken");

  const currentRefreshToken = async (): Promise<string> => {
    if (latest !== undefined) {
      return latest;
    }
    const loaded: unknown = await tokenStore.load();
    if (typeof loaded !== "string" || loaded === "") {
      throw invalid("got no Refresh token from tokenStore.load()");
    }
    return loaded;
  };

  const mint = async (): Promise<CachedToken> => {
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: await currentRefreshToken(),
    });
    if (scope !== "") {
      form.set("scope", scope);
    }
    const grant = await exchangeGrant(
      endpoint,
      credentials,
      form,
      REFRESH_GUIDANCE,
    );
    // The token just presented is superseded whatever happens next, so this
    // process must never present it again, even if the save below fails.
    latest = grant.refreshToken;
    try {
      await tokenStore.save(grant.refreshToken);
    } catch (cause) {
      // The store didn't record the rotation, so the next process would load
      // and replay the superseded token and revoke the Grant. Using the new
      // Access token would hide that until it's too late, so raise instead.
      throw saveFailed(cause);
    }
    return {
      accessToken: grant.accessToken,
      expiresAt: grant.requestedAt + grant.expiresIn * 1000,
    };
  };

  return cachingTokenProvider(mint, endpoint.clock);
};
