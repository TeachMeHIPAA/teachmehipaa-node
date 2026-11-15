import {
  ApiError,
  ConnectionError,
  OAuthError,
  TeachMeHipaaError,
  TimeoutError,
  noResponseDetails,
  type TeachMeHipaaErrorDetails,
} from "./errors.js";
import {
  basicAuthorization,
  exchangeAtTokenEndpoint,
  type TokenEndpoint,
} from "./token-provider.js";

/** What a Grant's token exchange returns. */
export interface GrantTokens {
  readonly accessToken: string;
  /** Replaces the one you exchanged; save it before anything else. */
  readonly refreshToken: string;
  /** Seconds until the Access token expires. */
  readonly expiresIn: number;
  /** The Scopes the Access token carries. */
  readonly scopes: readonly string[];
}

export interface GrantExchange extends GrantTokens {
  /** When the request left, so expiry can't stretch past the real lifetime. */
  readonly requestedAt: number;
}

/** What to tell the caller when an exchange fails in a way only they can fix. */
export interface ExchangeGuidance {
  /** For a network failure, whose outcome is unknown. */
  readonly connection: string;
  /** For `invalid_grant`, or `undefined` to keep the endpoint's words. */
  readonly invalidGrant?: string;
}

const detailsOf = (
  error: TeachMeHipaaError,
  message: string,
): TeachMeHipaaErrorDetails => ({
  message,
  status: error.status,
  code: error.code,
  title: error.title,
  detail: error.detail,
  errors: error.errors,
  requestId: error.requestId,
  headers: error.headers,
  raw: error.raw,
  cause: error.cause,
});

const withGuidance = (error: unknown, guidance: ExchangeGuidance): unknown => {
  if (error instanceof ConnectionError) {
    const message = `${error.message}. ${guidance.connection}`;
    return error instanceof TimeoutError
      ? new TimeoutError(detailsOf(error, message))
      : new ConnectionError(detailsOf(error, message));
  }
  if (
    error instanceof OAuthError &&
    error.code === "invalid_grant" &&
    guidance.invalidGrant !== undefined
  ) {
    return new OAuthError(
      detailsOf(error, `${error.message}. ${guidance.invalidGrant}`),
    );
  }
  return error;
};

const missingRefreshToken = (): ApiError =>
  // `raw` stays null: the body holds a live Access token, which must not
  // reach error reporters.
  new ApiError({
    ...noResponseDetails("The token endpoint answered without a refresh_token"),
    status: 200,
  });

/**
 * Runs one `authorization_code` or `refresh_token` exchange, exactly once:
 * replaying a spent code or a superseded Refresh token revokes the Grant
 * (ADR-0004), so a failure is raised with guidance instead of retried.
 */
export const exchangeGrant = async (
  endpoint: TokenEndpoint,
  credentials: { readonly clientId: string; readonly clientSecret: string },
  form: URLSearchParams,
  guidance: ExchangeGuidance,
): Promise<GrantExchange> => {
  const { token, requestedAt } = await exchangeAtTokenEndpoint(
    endpoint,
    form,
    basicAuthorization(credentials.clientId, credentials.clientSecret),
    0,
  ).catch((error: unknown) => {
    throw withGuidance(error, guidance);
  });
  const refreshToken = token.refresh_token;
  if (typeof refreshToken !== "string" || refreshToken === "") {
    throw missingRefreshToken();
  }
  return {
    accessToken: token.access_token,
    refreshToken,
    expiresIn: token.expires_in,
    scopes:
      typeof token.scope === "string"
        ? token.scope.split(" ").filter((scope) => scope !== "")
        : [],
    requestedAt,
  };
};
