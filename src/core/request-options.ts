/** Per-call settings, always the last argument of a method. */
export interface RequestOptions {
  /**
   * Sent as `x-request-id` so you can correlate your logs with TeachMeHIPAA
   * support. Must match `^[A-Za-z0-9._-]{1,128}$` or the API replaces it.
   */
  readonly requestId?: string;
  /** Milliseconds to wait for a response; overrides the client's `timeout`. */
  readonly timeout?: number;
}
