/** One invalid field from a `validation_failed` problem. */
export interface FieldError {
  /** Dot-joined path, or `Idempotency-Key` for a missing header. */
  readonly path: string;
  readonly message: string;
}

export interface TeachMeHipaaErrorDetails {
  readonly message: string;
  readonly status: number | null;
  readonly code: string | null;
  readonly title: string | null;
  readonly detail: string | null;
  readonly errors: readonly FieldError[];
  readonly requestId: string | null;
  readonly headers: Readonly<Record<string, string>>;
  readonly raw: unknown;
  /** The underlying failure, for errors raised without a response. */
  readonly cause?: unknown;
}

/**
 * The base of every error the library raises about an API call. Catch a
 * subclass to handle one kind of failure; `name` survives minification.
 */
export class TeachMeHipaaError extends Error {
  override readonly name: string = "TeachMeHipaaError";
  /** The HTTP status, or `null` when no response arrived. */
  readonly status: number | null;
  /**
   * The machine-readable reason, such as `seat_unavailable`. Branch on this;
   * new codes may appear at any time.
   */
  readonly code: string | null;
  readonly title: string | null;
  readonly detail: string | null;
  readonly errors: readonly FieldError[];
  /** Quote this to TeachMeHIPAA support. */
  readonly requestId: string | null;
  readonly headers: Readonly<Record<string, string>>;
  /** The response body: parsed JSON when it was JSON, otherwise the text. */
  readonly raw: unknown;

  constructor(details: TeachMeHipaaErrorDetails) {
    super(
      details.message,
      details.cause === undefined ? undefined : { cause: details.cause },
    );
    this.status = details.status;
    this.code = details.code;
    this.title = details.title;
    this.detail = details.detail;
    this.errors = details.errors;
    this.requestId = details.requestId;
    this.headers = details.headers;
    this.raw = details.raw;
  }
}

/** 401: the Access token was missing, expired or revoked. */
export class AuthenticationError extends TeachMeHipaaError {
  override readonly name: string = "AuthenticationError";
}

/** 403: the Access token lacks a Scope, or the Organization may not do this. */
export class PermissionDeniedError extends TeachMeHipaaError {
  override readonly name: string = "PermissionDeniedError";
}

/** 404: no such object in this Organization. */
export class NotFoundError extends TeachMeHipaaError {
  override readonly name: string = "NotFoundError";
}

/** 409: the object's state forbids this, such as `seat_unavailable`. */
export class ConflictError extends TeachMeHipaaError {
  override readonly name: string = "ConflictError";
}

/** 412 for a stale `If-Match`, 428 for a missing one. */
export class PreconditionFailedError extends TeachMeHipaaError {
  override readonly name: string = "PreconditionFailedError";
}

/** 400, 405, 406, 415 or 422: the request itself is wrong. */
export class InvalidRequestError extends TeachMeHipaaError {
  override readonly name: string = "InvalidRequestError";
}

/** 422 `idempotency_key_reuse`: the key was already used with another body. */
export class IdempotencyError extends InvalidRequestError {
  override readonly name: string = "IdempotencyError";
}

/** 429: too many requests. */
export class RateLimitError extends TeachMeHipaaError {
  override readonly name: string = "RateLimitError";
  /** Seconds the API asked you to wait, or `null` when it didn't say. */
  readonly retryAfter: number | null;

  constructor(
    details: TeachMeHipaaErrorDetails & { readonly retryAfter: number | null },
  ) {
    super(details);
    this.retryAfter = details.retryAfter;
  }
}

/** 5xx, or a response the library could not understand. */
export class ApiError extends TeachMeHipaaError {
  override readonly name: string = "ApiError";
}

/** The token endpoint refused to issue an Access token. */
export class OAuthError extends TeachMeHipaaError {
  override readonly name: string = "OAuthError";
}

/** No response arrived: the network failed or the body was cut off. */
export class ConnectionError extends TeachMeHipaaError {
  override readonly name: string = "ConnectionError";
}

/** No response arrived within the timeout. */
export class TimeoutError extends ConnectionError {
  override readonly name: string = "TimeoutError";
}

/** Every error class, also reachable as `TeachMeHipaa.errors`. */
export const errors = Object.freeze({
  TeachMeHipaaError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  ConflictError,
  PreconditionFailedError,
  InvalidRequestError,
  IdempotencyError,
  RateLimitError,
  ApiError,
  OAuthError,
  ConnectionError,
  TimeoutError,
});
