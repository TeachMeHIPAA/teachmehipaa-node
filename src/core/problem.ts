import { TeachMeHipaaError, type FieldError } from "./errors.js";
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

const fallbackMessage = (response: Response, body: ResponseBody): string =>
  body.json
    ? `TeachMeHIPAA API responded with HTTP ${String(response.status)}`
    : `Expected a JSON response but got ${
        response.headers.get("content-type") ?? "no content type"
      } with HTTP ${String(response.status)}; check the base URL`;

export const errorFromResponse = (
  response: Response,
  body: ResponseBody,
): TeachMeHipaaError => {
  const problem = isRecord(body.value) ? body.value : {};
  const title = stringOrNull(problem.title);
  const detail = stringOrNull(problem.detail);
  const code = stringOrNull(problem.code);
  const summary = [title, detail].filter((part) => part !== null).join(": ");
  return new TeachMeHipaaError({
    message: summary === "" ? fallbackMessage(response, body) : summary,
    status: response.status,
    code,
    title,
    detail,
    errors: fieldErrors(problem.errors),
    requestId: response.headers.get("x-request-id"),
    headers: headersToRecord(response.headers),
    raw: body.value,
  });
};

/** The token endpoint answers with RFC 6749 `{error, error_description}`. */
export const oauthErrorFromResponse = (
  response: Response,
  body: ResponseBody,
): TeachMeHipaaError => {
  const oauth = isRecord(body.value) ? body.value : {};
  const code = stringOrNull(oauth.error);
  const detail = stringOrNull(oauth.error_description);
  return new TeachMeHipaaError({
    message:
      code === null
        ? fallbackMessage(response, body)
        : [code, detail].filter((part) => part !== null).join(": "),
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
