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

/**
 * An ETag as the API sent it, or any object the library returned, whose
 * `lastResponse.etag` is then used: `{ ifMatch: learner }`.
 */
export type ETagSource =
  string | { readonly lastResponse: { readonly etag: string | null } };

/** Options for a write the API can make conditional on the object's ETag. */
export interface ConditionalWriteOptions extends RequestOptions {
  /**
   * Sent as `If-Match`: the write happens only if the object is unchanged
   * since you read it, else it raises `PreconditionFailedError` (412). `"*"`
   * matches any version. An object whose response had no ETag raises a
   * `TypeError` before anything is sent.
   */
  readonly ifMatch?: ETagSource;
}

/** Options for a read the API can skip when your copy is current. */
export interface ConditionalReadOptions extends RequestOptions {
  /**
   * Sent as `If-None-Match`: when the object still has this ETag, the API
   * answers 304 and the method resolves `NotModified` instead of the object.
   */
  readonly ifNoneMatch?: ETagSource;
}

/** Options for a file download. */
export interface DownloadOptions extends RequestOptions {
  /**
   * Resolve as soon as the headers arrive, with the file as a web
   * `ReadableStream` in `stream`, instead of reading it all into `data`.
   * Retries and the `timeout` cover only getting the response started; a
   * failure while you read the stream surfaces from the stream.
   */
  readonly asStream?: boolean;
}
