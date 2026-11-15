import { describe, expect, it } from "vitest";
import TeachMeHipaa, {
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
  TeachMeHipaaError,
  TimeoutError,
  WebhookSignatureError,
} from "../src/index.js";
import {
  createFakeTransport,
  type ScriptStep,
} from "./support/fake-transport.js";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  LEARNER_ID,
  LEARNER_ROUTE,
  ORG_ID,
  TOKEN_ROUTE,
  tokenReply,
} from "./support/fixtures.js";

const REQUEST_ID = "req-404-abc";

// Retries are off so each scripted failure is the one the caller sees. The
// step is scripted twice because a 401 re-mints and replays once.
const retrieveFailingWith = async (step: ScriptStep): Promise<unknown> => {
  const fake = createFakeTransport()
    .script(TOKEN_ROUTE, tokenReply("jwt-1"), tokenReply("jwt-2"))
    .script(LEARNER_ROUTE, step, step);
  const client = new TeachMeHipaa({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    organizationId: ORG_ID,
    maxRetries: 0,
    transport: fake.transport,
  });
  return client.learners.retrieve(LEARNER_ID).then(
    () => expect.fail("expected the call to be rejected"),
    (error: unknown) => error,
  );
};

const problem = (status: number, code: string) => ({
  status,
  headers: { "content-type": "application/problem+json" },
  json: { title: "Problem", status, code, detail: `A ${code} problem.` },
});

describe("Errors", () => {
  it("raises a problem+json response with its code, detail and request id", async () => {
    const error = await retrieveFailingWith({
      status: 404,
      headers: {
        "content-type": "application/problem+json",
        "x-request-id": REQUEST_ID,
      },
      json: {
        title: "Not Found",
        status: 404,
        code: "not_found",
        detail: "No such learner.",
      },
    });

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toBeInstanceOf(TeachMeHipaaError);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      name: "NotFoundError",
      status: 404,
      code: "not_found",
      title: "Not Found",
      detail: "No such learner.",
      requestId: REQUEST_ID,
      errors: [],
    });
    expect((error as TeachMeHipaaError).headers["x-request-id"]).toBe(
      REQUEST_ID,
    );
  });

  it.each([
    [400, "validation_failed", InvalidRequestError],
    [401, "unauthorized", AuthenticationError],
    [403, "forbidden", PermissionDeniedError],
    [403, "spend_limit_exceeded", PermissionDeniedError],
    [404, "not_found", NotFoundError],
    [405, "method_not_allowed", InvalidRequestError],
    [406, "not_acceptable", InvalidRequestError],
    [409, "seat_unavailable", ConflictError],
    [412, "precondition_failed", PreconditionFailedError],
    [415, "unsupported_media_type", InvalidRequestError],
    [422, "batch_too_large", InvalidRequestError],
    [428, "precondition_required", PreconditionFailedError],
    [429, "rate_limited", RateLimitError],
    [500, "internal_error", ApiError],
    [502, "refund_failed", ApiError],
    [503, "temporarily_unavailable", ApiError],
  ])("raises HTTP %i %s as %o", async (status, code, errorClass) => {
    const error = await retrieveFailingWith(problem(status, code));

    expect(error).toBeInstanceOf(errorClass);
    expect(error).toMatchObject({
      name: errorClass.name,
      status,
      code,
      detail: `A ${code} problem.`,
    });
  });

  it("raises idempotency_key_reuse as an IdempotencyError, which is an invalid request", async () => {
    const error = await retrieveFailingWith(
      problem(422, "idempotency_key_reuse"),
    );

    expect(error).toBeInstanceOf(IdempotencyError);
    expect(error).toBeInstanceOf(InvalidRequestError);
    expect(error).toMatchObject({ status: 422, code: "idempotency_key_reuse" });
  });

  it("keeps an unknown code as an open string", async () => {
    const error = await retrieveFailingWith(problem(409, "brand_new_reason"));

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ code: "brand_new_reason" });
  });

  it("gives a RateLimitError the Retry-After seconds", async () => {
    const error = await retrieveFailingWith({
      ...problem(429, "rate_limited"),
      headers: {
        "content-type": "application/problem+json",
        "retry-after": "7",
      },
    });

    expect(error).toBeInstanceOf(RateLimitError);
    expect((error as RateLimitError).retryAfter).toBe(7);
  });

  it("gives a RateLimitError without Retry-After a null retryAfter", async () => {
    const error = await retrieveFailingWith(problem(429, "rate_limited"));

    expect((error as RateLimitError).retryAfter).toBeNull();
  });

  it("carries field errors from a validation problem", async () => {
    const error = await retrieveFailingWith({
      status: 422,
      headers: { "content-type": "application/problem+json" },
      json: {
        title: "Unprocessable Entity",
        status: 422,
        code: "validation_failed",
        errors: [{ path: "courseId", message: "Too long" }],
      },
    });

    expect(error).toBeInstanceOf(InvalidRequestError);
    expect(error).toMatchObject({
      status: 422,
      code: "validation_failed",
      detail: null,
      errors: [{ path: "courseId", message: "Too long" }],
    });
  });

  it("raises a 200 HTML page as an ApiError instead of a parse crash", async () => {
    const error = await retrieveFailingWith({
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
      body: "<!DOCTYPE html><html><body>Not here</body></html>",
    });

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 200,
      code: null,
      raw: "<!DOCTYPE html><html><body>Not here</body></html>",
    });
    expect((error as Error).message).toMatch(/base URL/);
  });

  it("raises a JSON body that claims JSON but does not parse as an ApiError", async () => {
    const error = await retrieveFailingWith({
      status: 200,
      headers: { "content-type": "application/json" },
      body: '{"learnerId": "sub_',
    });

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 200, raw: '{"learnerId": "sub_' });
  });

  it("raises a request that got no response as a ConnectionError", async () => {
    const cause = new TypeError("fetch failed");
    const error = await retrieveFailingWith(() => {
      throw cause;
    });

    expect(error).toBeInstanceOf(ConnectionError);
    expect(error).toBeInstanceOf(TeachMeHipaaError);
    expect(error).not.toBeInstanceOf(TimeoutError);
    expect(error).toMatchObject({
      name: "ConnectionError",
      status: null,
      code: null,
      requestId: null,
      headers: {},
      cause,
    });
  });

  it("raises a request that timed out as a TimeoutError, which is a ConnectionError", async () => {
    const error = await retrieveFailingWith(() => {
      throw new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError",
      );
    });

    expect(error).toBeInstanceOf(TimeoutError);
    expect(error).toBeInstanceOf(ConnectionError);
    expect(error).toMatchObject({ name: "TimeoutError", status: null });
  });

  it("raises a body cut off mid-read as a ConnectionError", async () => {
    const error = await retrieveFailingWith({
      status: 200,
      headers: { "content-type": "application/json" },
      bodyError: new TypeError("terminated"),
    });

    expect(error).toBeInstanceOf(ConnectionError);
    expect(error).toMatchObject({ status: null });
  });

  it("raises the token endpoint's error as an OAuthError", async () => {
    const fake = createFakeTransport().script(TOKEN_ROUTE, {
      status: 400,
      headers: { "x-request-id": "req-token-9" },
      json: {
        error: "invalid_scope",
        error_description: "The requested scope is not granted.",
      },
    });
    const client = new TeachMeHipaa({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      organizationId: ORG_ID,
      transport: fake.transport,
    });

    const error: unknown = await client.learners
      .retrieve(LEARNER_ID)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OAuthError);
    expect(error).toBeInstanceOf(TeachMeHipaaError);
    expect(error).toMatchObject({
      name: "OAuthError",
      status: 400,
      code: "invalid_scope",
      detail: "The requested scope is not granted.",
      requestId: "req-token-9",
    });
  });

  it("exposes every error class on the client class, as Stripe does", () => {
    expect(TeachMeHipaa.errors).toEqual({
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
      WebhookSignatureError,
    });
  });
});
