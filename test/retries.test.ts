import { describe, expect, it } from "vitest";
import TeachMeHipaa, {
  ApiError,
  ConflictError,
  ConnectionError,
  NotFoundError,
  RateLimitError,
  type TeachMeHipaaOptions,
} from "../src/index.js";
import { createFakeClock } from "./support/fake-clock.js";
import {
  createFakeTransport,
  type FakeTransport,
  type ScriptStep,
  type ScriptedReply,
} from "./support/fake-transport.js";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  LEARNER_ID,
  LEARNER_ROUTE,
  ORG_ID,
  TOKEN_ROUTE,
  learnerBody,
  learnerReply,
  tokenReply,
} from "./support/fixtures.js";

const problem = (
  status: number,
  code: string,
  headers: Readonly<Record<string, string>> = {},
): ScriptedReply => ({
  status,
  headers: { "content-type": "application/problem+json", ...headers },
  json: { title: "Problem", status, code },
});

const networkFailure: ScriptStep = () => {
  throw new TypeError("fetch failed");
};

const clientWith = (
  fake: FakeTransport,
  options: Partial<TeachMeHipaaOptions> = {},
) => {
  const clock = createFakeClock();
  const client = new TeachMeHipaa({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    organizationId: ORG_ID,
    transport: fake.transport,
    clock,
    ...options,
  });
  return { client, clock };
};

const rejectionOf = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => expect.fail("expected the call to be rejected"),
    (error: unknown) => error,
  );

describe("Retries", () => {
  it.each<[string, ScriptStep]>([
    ["a network error", networkFailure],
    ["409 conflict (request in flight)", problem(409, "conflict")],
    ["429 rate_limited", problem(429, "rate_limited")],
    ["500", problem(500, "internal_error")],
    ["502 refund_failed", problem(502, "refund_failed")],
    ["503", problem(503, "temporarily_unavailable")],
  ])("retries a GET after %s and returns the result", async (_, failure) => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, failure, learnerReply());
    const { client, clock } = clientWith(fake);

    const learner = await client.learners.retrieve(LEARNER_ID);

    expect(learner).toEqual(learnerBody);
    expect(fake.requestsTo(LEARNER_ROUTE)).toHaveLength(2);
    // The first backoff is 0.5 s: the cap of 0.5 s with jitter, floored at 0.5 s.
    expect(clock.sleeps).toEqual([500]);
  });

  it("gives up after two retries by default and raises the last error", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        LEARNER_ROUTE,
        problem(503, "temporarily_unavailable"),
        problem(503, "temporarily_unavailable"),
        problem(500, "internal_error"),
      );
    const { client } = clientWith(fake);

    const error = await rejectionOf(client.learners.retrieve(LEARNER_ID));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 500, code: "internal_error" });
    expect(fake.requestsTo(LEARNER_ROUTE)).toHaveLength(3);
  });

  it("raises a ConnectionError once network retries run out", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, networkFailure, networkFailure, networkFailure);
    const { client } = clientWith(fake);

    const error = await rejectionOf(client.learners.retrieve(LEARNER_ID));

    expect(error).toBeInstanceOf(ConnectionError);
    expect(fake.requestsTo(LEARNER_ROUTE)).toHaveLength(3);
  });

  it("doubles the backoff with jitter up to a 5 s cap", async () => {
    const failures = Array.from({ length: 7 }, () =>
      problem(503, "temporarily_unavailable"),
    );
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, ...failures, learnerReply());
    const { client, clock } = clientWith(fake, { maxRetries: 7 });

    await client.learners.retrieve(LEARNER_ID);

    // Ceilings 0.5, 1, 2, 4, 5, 5, 5 s; jitter keeps each within 50–100 % of
    // its ceiling and never below 0.5 s.
    const ranges = [
      [500, 500],
      [500, 1000],
      [1000, 2000],
      [2000, 4000],
      [2500, 5000],
      [2500, 5000],
      [2500, 5000],
    ];
    expect(clock.sleeps).toHaveLength(ranges.length);
    clock.sleeps.forEach((sleep, index) => {
      const [low, high] = ranges[index] ?? [];
      expect(sleep).toBeGreaterThanOrEqual(low ?? Infinity);
      expect(sleep).toBeLessThanOrEqual(high ?? -Infinity);
    });
  });

  it("waits as long as Retry-After says, in seconds", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        LEARNER_ROUTE,
        problem(429, "rate_limited", { "retry-after": "3" }),
        learnerReply(),
      );
    const { client, clock } = clientWith(fake);

    await client.learners.retrieve(LEARNER_ID);

    expect(clock.sleeps).toEqual([3000]);
  });

  it("waits until a Retry-After HTTP-date", async () => {
    const clock = createFakeClock(Date.UTC(2026, 10, 15, 12, 0, 0));
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        LEARNER_ROUTE,
        problem(503, "temporarily_unavailable", {
          "retry-after": "Sun, 15 Nov 2026 12:00:10 GMT",
        }),
        learnerReply(),
      );
    const { client } = clientWith(fake, { clock });

    await client.learners.retrieve(LEARNER_ID);

    expect(clock.sleeps).toEqual([10_000]);
  });

  it("waits at most 60 s however long Retry-After asks for", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        LEARNER_ROUTE,
        problem(429, "rate_limited", { "retry-after": "3600" }),
        learnerReply(),
      );
    const { client, clock } = clientWith(fake);

    await client.learners.retrieve(LEARNER_ID);

    expect(clock.sleeps).toEqual([60_000]);
  });

  it.each<[string, ScriptedReply, new (...args: never[]) => Error]>([
    ["409 seat_unavailable", problem(409, "seat_unavailable"), ConflictError],
    ["404", problem(404, "not_found"), NotFoundError],
    ["400", problem(400, "validation_failed"), Error],
    ["412", problem(412, "precondition_failed"), Error],
  ])("does not retry %s", async (_, failure, errorClass) => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, failure);
    const { client, clock } = clientWith(fake);

    const error = await rejectionOf(client.learners.retrieve(LEARNER_ID));

    expect(error).toBeInstanceOf(errorClass);
    expect(fake.requestsTo(LEARNER_ROUTE)).toHaveLength(1);
    expect(clock.sleeps).toEqual([]);
  });

  it("does not retry when the client sets maxRetries to 0", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, problem(429, "rate_limited"));
    const { client } = clientWith(fake, { maxRetries: 0 });

    const error = await rejectionOf(client.learners.retrieve(LEARNER_ID));

    expect(error).toBeInstanceOf(RateLimitError);
    expect(fake.requestsTo(LEARNER_ROUTE)).toHaveLength(1);
  });

  it("lets one request override the client's maxRetries", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        LEARNER_ROUTE,
        networkFailure,
        networkFailure,
        networkFailure,
        learnerReply(),
        problem(503, "temporarily_unavailable"),
      );
    const { client } = clientWith(fake, { maxRetries: 0 });

    const learner = await client.learners.retrieve(LEARNER_ID, undefined, {
      maxRetries: 3,
    });
    expect(learner.lastResponse.status).toBe(200);
    expect(fake.requestsTo(LEARNER_ROUTE)).toHaveLength(4);

    await expect(client.learners.retrieve(LEARNER_ID)).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(fake.requestsTo(LEARNER_ROUTE)).toHaveLength(5);
  });

  it("sends each retry with the per-request timeout", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, networkFailure, learnerReply());
    const { client } = clientWith(fake, { timeout: 30_000 });

    await client.learners.retrieve(LEARNER_ID, undefined, { timeout: 2_000 });

    expect(fake.requestsTo(LEARNER_ROUTE).map((r) => r.timeout)).toEqual([
      2_000, 2_000,
    ]);
  });
});
