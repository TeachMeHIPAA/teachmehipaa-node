import {
  ApiError,
  AuthenticationError,
  ConflictError,
  ConnectionError,
  IdempotencyError,
  InvalidRequestError,
  NotFoundError,
  OAuthError,
  PermissionDeniedError,
  PreconditionFailedError,
  RateLimitError,
  TimeoutError,
  type FieldError,
  type TeachMeHipaaError,
  type TeachMeHipaaErrorDetails,
} from "./errors.js";
import { headersToRecord } from "./response.js";

const isJsonContentType = (contentType: string | null): boolean =>
  contentType !== null &&
  /^application\/([\w.+-]*\+)?json\b/i.test(contentType);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringOrNull = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

const fieldErrors = (value: unknown): readonly FieldError[] =>
  Array.isArray(value)
    ? value.filter(
        (item): item is FieldError =>
          isRecord(item) &&
          typeof item.path === "string" &&
          typeof item.message === "string",
      )
    : [];

/** What a problem says, and a one-line summary of it for an error message. */
export const problemFields = (
  value: unknown,
): Pick<TeachMeHipaaErrorDetails, "code" | "title" | "detail" | "errors"> & {
  readonly summary: string;
} => {
  const problem = isRecord(value) ? value : {};
  const title = stringOrNull(problem.title);
  const detail = stringOrNull(problem.detail);
  return {
    code: stringOrNull(problem.code),
    title,
    detail,
    errors: fieldErrors(problem.errors),
    summary: [title, detail].filter((part) => part !== null).join(": "),
  };
};

/**
 * Reads a body only after checking it claims to be JSON: unknown paths answer
 * with a 200 HTML page, which must not reach `JSON.parse`.
 */
export interface ResponseBody {
  readonly json: boolean;
  readonly value: unknown;
}

export const readBody = async (response: Response): Promise<ResponseBody> => {
  const text = await response.text();
  if (!isJsonContentType(response.headers.get("content-type"))) {
    return { json: false, value: text };
  }
  try {
    return { json: true, value: JSON.parse(text) as unknown };
  } catch {
    return { json: false, value: text };
  }
};

/**
 * `Retry-After` as seconds from `now`. It may be delay-seconds or an
 * HTTP-date (RFC 9110 §10.2.3); anything else counts as absent.
 */
export const retryAfterSeconds = (
  value: string | undefined,
  now: number,
): number | null => {
  if (value === undefined) {
    return null;
  }
  if (/^\s*\d+\s*$/.test(value)) {
    return Number(value);
  }
  const date = Date.parse(value);
  return Number.isNaN(date)
    ? null
    : Math.max(0, Math.ceil((date - now) / 1000));
};

type ErrorClass = new (details: TeachMeHipaaErrorDetails) => TeachMeHipaaError;

const errorClassFor = (status: number, code: string | null): ErrorClass => {
  switch (status) {
    case 401:
      return AuthenticationError;
    case 403:
      return PermissionDeniedError;
    case 404:
      return NotFoundError;
    case 409:
      return ConflictError;
    case 412:
    case 428:
      return PreconditionFailedError;
    case 422:
      return code === "idempotency_key_reuse"
        ? IdempotencyError
        : InvalidRequestError;
    case 400:
    case 405:
    case 406:
    case 415:
      return InvalidRequestError;
    default:
      return ApiError;
  }
};

const fallbackMessage = (response: Response, body: ResponseBody): string =>
  body.json
    ? `TeachMeHIPAA API responded with HTTP ${String(response.status)}`
    : `Expected a JSON response but got ${
        response.headers.get("content-type") ?? "no content type"
      } with HTTP ${String(response.status)}; check the base URL`;

/** Maps a response the caller can't use to the error class for its status. */
export const errorFromResponse = (
  response: Response,
  body: ResponseBody,
  now: number,
): TeachMeHipaaError => {
  const { summary, ...problem } = problemFields(body.value);
  const { code } = problem;
  const headers = headersToRecord(response.headers);
  const details: TeachMeHipaaErrorDetails = {
    message: summary === "" ? fallbackMessage(response, body) : summary,
    status: response.status,
    ...problem,
    requestId: response.headers.get("x-request-id"),
    headers,
    raw: body.value,
  };
  if (response.status === 429) {
    return new RateLimitError({
      ...details,
      retryAfter: retryAfterSeconds(headers["retry-after"], now),
    });
  }
  // A success status only gets here with a body the library can't use.
  return response.ok
    ? new ApiError(details)
    : new (errorClassFor(response.status, code))(details);
};

/**
 * The token endpoint answers with RFC 6749 `{error, error_description}`;
 * anything else from it (an HTML page, a bare 502) maps like any response.
 */
export const oauthErrorFromResponse = (
  response: Response,
  body: ResponseBody,
  now: number,
): TeachMeHipaaError => {
  const oauth = isRecord(body.value) ? body.value : {};
  const code = stringOrNull(oauth.error);
  if (code === null) {
    return errorFromResponse(response, body, now);
  }
  const detail = stringOrNull(oauth.error_description);
  return new OAuthError({
    message: [code, detail].filter((part) => part !== null).join(": "),
    status: response.status,
    code,
    title: null,
    detail,
    errors: [],
    requestId: response.headers.get("x-request-id"),
    headers: headersToRecord(response.headers),
    raw: body.value,
  });
};

const isTimeout = (cause: unknown): boolean =>
  cause instanceof Error && cause.name === "TimeoutError";

/** For a request that got no complete response. */
export const connectionError = (
  cause: unknown,
  timeout: number,
): TeachMeHipaaError => {
  const details: TeachMeHipaaErrorDetails = {
    message: isTimeout(cause)
      ? `TeachMeHIPAA API did not respond within ${String(timeout)} ms`
      : `Could not reach the TeachMeHIPAA API: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
    status: null,
    code: null,
    title: null,
    detail: null,
    errors: [],
    requestId: null,
    headers: {},
    raw: null,
    cause,
  };
  return isTimeout(cause)
    ? new TimeoutError(details)
    : new ConnectionError(details);
};
