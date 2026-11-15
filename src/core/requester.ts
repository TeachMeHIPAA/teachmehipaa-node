import { randomUUID } from "node:crypto";
import type { Clock } from "./clock.js";
import { TeachMeHipaaError } from "./errors.js";
import { createOrganizationBinding } from "./organization.js";
import {
  connectionError,
  errorFromResponse,
  readBody,
  type ResponseBody,
} from "./problem.js";
import type { ETagSource, RequestOptions } from "./request-options.js";
import {
  responseMetadata,
  withLastResponse,
  type BinaryResponse,
  type BinaryStreamResponse,
  type NotModified,
  type WithLastResponse,
} from "./response.js";
import {
  isTransient,
  serverDelay,
  withRetries,
  type Attempt,
} from "./retry.js";
import type { TokenProvider } from "./token-provider.js";
import type { HttpMethod, Transport } from "./transport.js";
import { multipartBody, type BinaryPart } from "./uploads.js";

export type QueryParams = Readonly<
  Record<string, string | number | boolean | undefined>
>;

/** Describes one API operation call. The generated layer builds these. */
export interface RequestSpec {
  readonly method: HttpMethod;
  /** Path template relative to the base URL, e.g. `/learners/{learnerId}`. */
  readonly path: string;
  readonly pathParams?: Readonly<Record<string, string>>;
  /** Org-scoped paths are prefixed with `/organizations/{orgId}`. */
  readonly organizationScoped: boolean;
  /**
   * The IR's `security`: `false` for public methods (`security: none`), which
   * are sent without an Access token so none is minted for them.
   */
  readonly authenticated: boolean;
  /**
   * The IR's `retrySafe`: GETs, operations that take an Idempotency-Key, and
   * those idempotent by meaning. PATCH and DELETE never are.
   */
  readonly retrySafe: boolean;
  /**
   * The IR's `idempotencyKey`. When `required`, each call gets one generated
   * key, reused by every retry, unless the caller passes their own.
   */
  readonly idempotencyKey: "required" | "none";
  readonly query?: QueryParams | undefined;
  /** Serialized as JSON, or as multipart for `multipart/form-data`. */
  readonly body?: unknown;
  /** Defaults to `application/json` when there is a body. */
  readonly contentType?: RequestContentType;
  /** The body fields sent as files in a multipart body. */
  readonly binaryParts?: readonly BinaryPart[];
  /** What a success looks like. Defaults to a JSON object. */
  readonly response?: ExpectedResponse;
  /** Sent as `If-Match`, for operations the IR marks as conditional. */
  readonly ifMatch?: ETagSource | undefined;
  /** Sent as `If-None-Match`; a 304 then resolves `NotModified`. */
  readonly ifNoneMatch?: ETagSource | undefined;
  readonly options?: RequestOptions | undefined;
}

export type RequestContentType =
  "application/json" | "application/merge-patch+json" | "multipart/form-data";

/** The IR's response kinds that change how a success is read. */
export type ExpectedResponse =
  | { readonly kind: "json" }
  /** A Learner write: `created` is set from 201 (created) vs 200 (existing). */
  | { readonly kind: "writeResult" }
  /** No body (204); success is the status alone. */
  | { readonly kind: "empty" }
  | {
      readonly kind: "binary";
      readonly contentType: string;
      /** Hand back the body unread, as a stream. */
      readonly stream?: boolean;
    };

export interface RequesterSettings {
  readonly baseUrl: string;
  readonly userAgent: string;
  readonly transport: Transport;
  readonly tokenProvider: TokenProvider;
  readonly timeout: number;
  readonly maxRetries: number;
  readonly organizationId: string | undefined;
  readonly clock: Clock;
}

/** Sends API requests with auth, the Organization binding and error mapping. */
export interface Requester {
  request<T extends object>(spec: RequestSpec): Promise<WithLastResponse<T>>;
  /** The client's clock, for hand-written methods that wait between calls. */
  readonly clock: Clock;
}

/** A call with its path resolved and its per-call values fixed. */
interface PreparedCall {
  readonly method: HttpMethod;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | FormData | undefined;
  readonly timeout: number;
  readonly maxRetries: number;
  readonly retrySafe: boolean;
  readonly authenticated: boolean;
  readonly expected: ExpectedResponse;
  /** The call sent `If-None-Match`, so a 304 is a success. */
  readonly conditionalRead: boolean;
}

/** What arrived: the whole file for a binary success, else the parsed body. */
type Payload =
  | { readonly kind: "binary"; readonly data: Uint8Array }
  | { readonly kind: "stream"; readonly stream: ReadableStream<Uint8Array> }
  | { readonly kind: "body"; readonly body: ResponseBody };

const mediaType = (contentType: string | null): string | null =>
  contentType?.split(";")[0]?.trim().toLowerCase() ?? null;

// A binary success must carry the type the IR promises: unknown paths answer
// 200 with an HTML page, which must not be handed back as a PDF.
const isBinarySuccess = (
  response: Response,
  expected: ExpectedResponse,
): boolean =>
  response.ok &&
  expected.kind === "binary" &&
  mediaType(response.headers.get("content-type")) ===
    expected.contentType.toLowerCase();

const readPayload = async (
  response: Response,
  expected: ExpectedResponse,
): Promise<Payload> => {
  if (!isBinarySuccess(response, expected)) {
    return { kind: "body", body: await readBody(response) };
  }
  if (expected.kind === "binary" && expected.stream === true) {
    return { kind: "stream", stream: response.body ?? new Blob([]).stream() };
  }
  return {
    kind: "binary",
    data: new Uint8Array(await response.arrayBuffer()),
  };
};

// RFC 6266: prefer the UTF-8 `filename*`, else the plain `filename`.
const filenameOf = (contentDisposition: string | null): string | null => {
  const header = contentDisposition ?? "";
  const encoded = /filename\*=UTF-8''([^;\s]+)/i.exec(header)?.[1];
  if (encoded !== undefined) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Malformed percent-encoding: use the plain parameter instead.
    }
  }
  return /filename="?([^";]+)"?/i.exec(header)?.[1] ?? null;
};

const fileHeaders = (
  response: Response,
): Pick<BinaryResponse, "contentType" | "filename"> => ({
  contentType: response.headers.get("content-type"),
  filename: filenameOf(response.headers.get("content-disposition")),
});

/** What a 2xx body resolves to, or `null` when the library can't use it. */
const successValue = (
  response: Response,
  body: ResponseBody,
  expected: ExpectedResponse,
): object | null => {
  switch (expected.kind) {
    case "empty":
      return {};
    case "binary":
      return null;
    case "json":
    case "writeResult": {
      if (!body.json || typeof body.value !== "object" || body.value === null) {
        return null;
      }
      return expected.kind === "writeResult"
        ? { ...body.value, created: response.status === 201 }
        : body.value;
    }
  }
};

const etagOf = (source: ETagSource, header: string): string => {
  if (typeof source === "string") {
    return source;
  }
  const { etag } = source.lastResponse;
  if (etag === null) {
    throw new TypeError(
      `TeachMeHipaa: ${header} was given an object whose response had no ETag`,
    );
  }
  return etag;
};

const expandPath = (
  template: string,
  params: Readonly<Record<string, string>>,
): string =>
  template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new TypeError(`Missing path parameter "${name}"`);
    }
    return encodeURIComponent(value);
  });

const queryString = (query: QueryParams | undefined): string => {
  const search = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([name, value]) => {
    if (value !== undefined) {
      search.append(name, String(value));
    }
  });
  const encoded = search.toString();
  return encoded === "" ? "" : `?${encoded}`;
};

const isUnauthorized = (error: TeachMeHipaaError): boolean =>
  error.status === 401 && error.code === "unauthorized";

// Async because a multipart body reads its files, once per call.
const encodeBody = async (
  spec: RequestSpec,
): Promise<string | FormData | undefined> => {
  if (spec.body === undefined) {
    return undefined;
  }
  return spec.contentType === "multipart/form-data"
    ? multipartBody(spec.body, spec.binaryParts ?? [])
    : JSON.stringify(spec.body);
};

export const createRequester = (settings: RequesterSettings): Requester => {
  const { clock } = settings;

  const exchange = async <T extends object>(
    call: PreparedCall,
    accessToken: string | null,
  ): Promise<Attempt<WithLastResponse<T>>> => {
    const received = await settings
      .transport({
        method: call.method,
        url: call.url,
        headers:
          accessToken === null
            ? call.headers
            : { ...call.headers, authorization: `Bearer ${accessToken}` },
        ...(call.body === undefined ? {} : { body: call.body }),
        timeout: call.timeout,
      })
      .then(async (response) => ({
        response,
        payload: await readPayload(response, call.expected),
      }))
      .catch((cause: unknown) => connectionError(cause, call.timeout));
    if (received instanceof TeachMeHipaaError) {
      return { ok: false, error: received };
    }
    const { response, payload } = received;
    const metadata = responseMetadata(response);
    if (payload.kind === "binary") {
      const file: BinaryResponse = {
        data: payload.data,
        ...fileHeaders(response),
      };
      return { ok: true, value: withLastResponse(file as T, metadata) };
    }
    if (payload.kind === "stream") {
      const file: BinaryStreamResponse = {
        stream: payload.stream,
        ...fileHeaders(response),
      };
      return { ok: true, value: withLastResponse(file as T, metadata) };
    }
    if (call.conditionalRead && response.status === 304) {
      const notModified: NotModified = {
        notModified: true,
        lastResponse: metadata,
      };
      return {
        ok: true,
        value: withLastResponse(notModified as T, metadata),
      };
    }
    const value = response.ok
      ? successValue(response, payload.body, call.expected)
      : null;
    if (value === null) {
      return {
        ok: false,
        error: errorFromResponse(response, payload.body, clock.now()),
      };
    }
    return {
      ok: true,
      value: withLastResponse(value as T, metadata),
    };
  };

  const send = <T extends object>(
    call: PreparedCall,
  ): Promise<WithLastResponse<T>> => {
    const { tokenProvider } = settings;
    let replayed = false;
    // A token revoked mid-flight gets one re-mint and replay per call. It
    // happens inside an attempt, so it never uses up a retry, and a 401 comes
    // before the API acts, so replaying even a PATCH is safe.
    const attempt = async (): Promise<Attempt<WithLastResponse<T>>> => {
      if (!call.authenticated) {
        return exchange<T>(call, null);
      }
      const accessToken = await tokenProvider.getAccessToken();
      const outcome = await exchange<T>(call, accessToken);
      if (outcome.ok || replayed || !isUnauthorized(outcome.error)) {
        return outcome;
      }
      replayed = true;
      tokenProvider.invalidate(accessToken);
      const renewed = await tokenProvider.getAccessToken();
      // A provider that can't renew (a static token) hands back the same
      // token, which the API would only refuse again.
      return renewed === accessToken ? outcome : exchange<T>(call, renewed);
    };
    return withRetries(attempt, {
      maxRetries: call.maxRetries,
      clock,
      delayBeforeRetry: (error, retryNumber) =>
        call.retrySafe && isTransient(error)
          ? serverDelay(error, retryNumber, clock.now())
          : null,
    });
  };

  // Runs once per call, so everything fixed here (the Idempotency-Key above
  // all) is identical on every retry.
  const prepare = (
    spec: RequestSpec,
    path: string,
    body: string | FormData | undefined,
  ): PreparedCall => {
    const options = spec.options ?? {};
    const idempotencyKey =
      options.idempotencyKey ??
      (spec.idempotencyKey === "required" ? randomUUID() : undefined);
    const contentType = spec.contentType ?? "application/json";
    const multipart = contentType === "multipart/form-data";
    const expected = spec.response ?? { kind: "json" };
    return {
      method: spec.method,
      url: `${settings.baseUrl}${path}${queryString(spec.query)}`,
      headers: {
        // Errors still arrive as problem+json, so a file download accepts both.
        accept:
          expected.kind === "binary"
            ? `${expected.contentType}, application/problem+json`
            : "application/json",
        "user-agent": settings.userAgent,
        // fetch writes a multipart Content-Type itself, with the boundary.
        ...(spec.body === undefined || multipart
          ? {}
          : { "content-type": contentType }),
        ...(idempotencyKey === undefined
          ? {}
          : { "idempotency-key": idempotencyKey }),
        ...(spec.ifMatch === undefined
          ? {}
          : { "if-match": etagOf(spec.ifMatch, "ifMatch") }),
        ...(spec.ifNoneMatch === undefined
          ? {}
          : { "if-none-match": etagOf(spec.ifNoneMatch, "ifNoneMatch") }),
        ...(options.requestId === undefined
          ? {}
          : { "x-request-id": options.requestId }),
      },
      body,
      timeout: options.timeout ?? settings.timeout,
      maxRetries: options.maxRetries ?? settings.maxRetries,
      retrySafe: spec.retrySafe,
      authenticated: spec.authenticated,
      expected,
      conditionalRead: spec.ifNoneMatch !== undefined,
    };
  };

  const organization = createOrganizationBinding(async () => {
    const introspection = await send<{ readonly orgId?: unknown }>(
      prepare(
        {
          method: "GET",
          path: "/auth/introspection",
          organizationScoped: false,
          authenticated: true,
          retrySafe: true,
          idempotencyKey: "none",
        },
        "/auth/introspection",
        undefined,
      ),
    );
    if (typeof introspection.orgId === "string" && introspection.orgId !== "") {
      return introspection.orgId;
    }
    const { lastResponse } = introspection;
    throw new TeachMeHipaaError({
      message:
        "The Access token is not bound to an Organization. Pass organizationId when you create the client.",
      status: lastResponse.status,
      code: null,
      title: null,
      detail: null,
      errors: [],
      requestId: lastResponse.requestId,
      headers: lastResponse.headers,
      raw: introspection,
    });
  }, settings.organizationId);

  return {
    clock,
    async request<T extends object>(
      spec: RequestSpec,
    ): Promise<WithLastResponse<T>> {
      const relative = expandPath(spec.path, spec.pathParams ?? {});
      const path = spec.organizationScoped
        ? `/organizations/${encodeURIComponent(await organization.organizationId())}${relative}`
        : relative;
      return send<T>(prepare(spec, path, await encodeBody(spec)));
    },
  };
};
