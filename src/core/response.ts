/** What the API said about the response a returned object came from. */
export interface ResponseMetadata {
  readonly status: number;
  /** Lower-case header names. */
  readonly headers: Readonly<Record<string, string>>;
  /** Quote this to TeachMeHIPAA support. */
  readonly requestId: string | null;
  /** Pass to `ifMatch` for a conditional update. */
  readonly etag: string | null;
}

export type WithLastResponse<T> = T & {
  readonly lastResponse: ResponseMetadata;
};

/** A response with no body, such as a delete's 204. */
export interface EmptyResponse {
  readonly lastResponse: ResponseMetadata;
}

/**
 * A conditional read's 304: the object still has the ETag you sent, so keep
 * using your copy. Tell it apart with `"notModified" in result`.
 */
export interface NotModified {
  readonly notModified: true;
  readonly lastResponse: ResponseMetadata;
}

/** A file the API sent, such as a Certificate PDF. */
export interface BinaryResponse {
  readonly data: Uint8Array;
  /** The `Content-Type`, e.g. `application/pdf`. */
  readonly contentType: string | null;
  /** The file name from `Content-Disposition`, when the API gives one. */
  readonly filename: string | null;
}

export const headersToRecord = (
  headers: Headers,
): Readonly<Record<string, string>> => Object.fromEntries(headers.entries());

export const responseMetadata = (response: Response): ResponseMetadata => ({
  status: response.status,
  headers: headersToRecord(response.headers),
  requestId: response.headers.get("x-request-id"),
  etag: response.headers.get("etag"),
});

// Non-enumerable, so spreading, serializing or comparing the object only sees
// the API's fields.
export const withLastResponse = <T extends object>(
  value: T,
  metadata: ResponseMetadata,
): WithLastResponse<T> =>
  Object.defineProperty(value, "lastResponse", {
    value: metadata,
    enumerable: false,
  }) as WithLastResponse<T>;

/** A file the API is sending, as a stream: a download with `asStream: true`. */
export interface BinaryStreamResponse {
  /** The file's bytes. Read it once; it is not buffered. */
  readonly stream: ReadableStream<Uint8Array>;
  /** The `Content-Type`, e.g. `application/pdf`. */
  readonly contentType: string | null;
  /** The file name from `Content-Disposition`, when the API gives one. */
  readonly filename: string | null;
}
