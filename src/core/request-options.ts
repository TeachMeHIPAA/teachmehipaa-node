/** Per-call settings, always the last argument of a method. */
export interface RequestOptions {
  /**
   * Sent as `x-request-id` so you can correlate your logs with TeachMeHIPAA
   * support. Must match `^[A-Za-z0-9._-]{1,128}$` or the API replaces it.
   */
  readonly requestId?: string;
  /** Milliseconds to wait for a response; overrides the client's `timeout`. */
  readonly timeout?: number;
  /**
   * Retries for this call if it fails transiently; overrides the client's
   * `maxRetries`. Only requests that are safe to replay are ever retried.
   */
  readonly maxRetries?: number;
  /**
   * Replaces the generated `Idempotency-Key`. Reuse one key to make a call
   * you repeat yourself, such as a sync job's replay, run at most once.
   */
  readonly idempotencyKey?: string;
}
