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
