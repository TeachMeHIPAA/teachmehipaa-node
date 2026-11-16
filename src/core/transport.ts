export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** One HTTP request, fully built: the transport only has to send it. */
export interface TransportRequest {
  readonly method: HttpMethod;
  readonly url: string;
  /** Lower-case header names. */
  readonly headers: Readonly<Record<string, string>>;
  /** JSON or form text, or a multipart body. */
  readonly body?: string | FormData;
  /** Milliseconds before the transport should abandon the request. */
  readonly timeout: number;
}

/**
 * The HTTP seam. Inject your own to add proxies or mTLS, or to fake the API in
 * tests. It resolves with any response, error statuses included, and rejects
 * only when no response arrived.
 */
export type Transport = (request: TransportRequest) => Promise<Response>;

export const fetchTransport =
  (fetchImpl: typeof fetch = globalThis.fetch): Transport =>
  (request) =>
    fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body ?? null,
      signal: AbortSignal.timeout(request.timeout),
    });
