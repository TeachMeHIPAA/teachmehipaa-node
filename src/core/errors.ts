import type { Operation } from "./operations.js";

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

/** The details of an error raised without a usable response. */
export const noResponseDetails = (
  message: string,
): TeachMeHipaaErrorDetails => ({
  message,
  status: null,
  code: null,
  title: null,
  detail: null,
  errors: [],
  requestId: null,
  headers: {},
  raw: null,
});

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

/**
 * An Operation finished with an `error`. The problem's fields are on the
 * error as on any API error; `requestId` and `headers` are the last poll's.
 */
export class OperationFailedError extends TeachMeHipaaError {
  override readonly name: string = "OperationFailedError";
  /** The finished Operation, with the problem in `error`. */
  readonly operation: Operation;

  constructor(
    details: TeachMeHipaaErrorDetails & { readonly operation: Operation },
  ) {
    super(details);
    this.operation = details.operation;
  }
}

/** `Operation.wait` gave up before the Operation was done. */
export class OperationTimeoutError extends TeachMeHipaaError {
  override readonly name: string = "OperationTimeoutError";
  /** The Operation as the last poll saw it. Wait on it again to keep going. */
  readonly operation: Operation;

  constructor(
    details: TeachMeHipaaErrorDetails & { readonly operation: Operation },
  ) {
    super(details);
    this.operation = details.operation;
  }
}

/** Why a Delivery failed verification; branch on `code`. */
export type WebhookSignatureErrorCode =
  | "missing_header"
  | "invalid_timestamp"
  | "timestamp_outside_tolerance"
  | "body_hash_mismatch"
  | "signature_mismatch";

/**
 * A Delivery failed verification: treat it as forged and answer 400. It
 * extends `TeachMeHipaaError` so one catch handles every library error, but
 * it never carries the body or headers, which hold Learner details
 * (ADR-0007) and would end up in error reporters.
 */
export class WebhookSignatureError extends TeachMeHipaaError {
  override readonly name: string = "WebhookSignatureError";
  declare readonly code: WebhookSignatureErrorCode;

  constructor(code: WebhookSignatureErrorCode, message: string) {
    super({ ...noResponseDetails(message), code });
  }
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
  OperationFailedError,
  OperationTimeoutError,
  WebhookSignatureError,
});
