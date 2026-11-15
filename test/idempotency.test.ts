import { describe, expect, it } from "vitest";
import TeachMeHipaa, { ApiError, ConnectionError } from "../src/index.js";
import { createFakeClock } from "./support/fake-clock.js";
import {
  createFakeTransport,
  type FakeTransport,
  type ScriptStep,
  type ScriptedReply,
  textBody,
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

const CREATE_ROUTE = `POST /v1/organizations/${ORG_ID}/learners`;
const UPDATE_ROUTE = `PATCH /v1/organizations/${ORG_ID}/learners/${LEARNER_ID}`;
const LAUNCH_LINK_ROUTE = `POST /v1/organizations/${ORG_ID}/learners/${LEARNER_ID}:createLaunchLink`;

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const unavailable: ScriptedReply = {
  status: 503,
  headers: { "content-type": "application/problem+json" },
  json: { title: "Service Unavailable", status: 503, code: "not_configured" },
};

const networkFailure: ScriptStep = () => {
  throw new TypeError("fetch failed");
};

const created: ScriptedReply = { status: 201, json: learnerBody };

/** `dev#/components/schemas/LearnerLaunchLink`. */
const launchLinkReply: ScriptedReply = {
  json: {
    url: "https://training.teachmehipaa.com/launch/ll_01JD9",
    expiresAt: "2026-11-15T12:05:00.000Z",
  },
};

const clientOn = (fake: FakeTransport) =>
  new TeachMeHipaa({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    organizationId: ORG_ID,
    transport: fake.transport,
    clock: createFakeClock(),
  });

describe("Idempotency keys and request bodies", () => {
  it("sends a create as JSON with a generated UUIDv4 Idempotency-Key", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(CREATE_ROUTE, created);

    const learner = await clientOn(fake).learners.create({
      email: "ana@example.com",
      externalId: "hr-123",
    });

    expect(learner.lastResponse.status).toBe(201);
    const [request] = fake.requestsTo(CREATE_ROUTE);
    expect(request?.headers["content-type"]).toBe("application/json");
    expect(request?.headers["idempotency-key"]).toMatch(UUID_V4);
    expect(JSON.parse(textBody(request))).toEqual({
      email: "ana@example.com",
      externalId: "hr-123",
    });
  });

  it("retries a create with the same Idempotency-Key and body", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(CREATE_ROUTE, unavailable, networkFailure, created);

    await clientOn(fake).learners.create({ email: "ana@example.com" });

    const attempts = fake.requestsTo(CREATE_ROUTE);
    expect(attempts).toHaveLength(3);
    const [first, ...retries] = attempts;
    retries.forEach((retry) => {
      expect(retry.headers["idempotency-key"]).toBe(
        first?.headers["idempotency-key"],
      );
      expect(retry.body).toBe(first?.body);
    });
  });

  it("generates a new Idempotency-Key for each call", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(CREATE_ROUTE, created, created);
    const client = clientOn(fake);

    await client.learners.create({ email: "ana@example.com" });
    await client.learners.create({ email: "ana@example.com" });

    const [first, second] = fake
      .requestsTo(CREATE_ROUTE)
      .map((request) => request.headers["idempotency-key"]);
    expect(first).toMatch(UUID_V4);
    expect(second).toMatch(UUID_V4);
    expect(second).not.toBe(first);
  });

  it("uses a caller-supplied Idempotency-Key as-is, retries included", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(CREATE_ROUTE, unavailable, created);

    await clientOn(fake).learners.create(
      { email: "ana@example.com" },
      { idempotencyKey: "hr-sync-2026-11-15-hr-123" },
    );

    expect(
      fake
        .requestsTo(CREATE_ROUTE)
        .map((request) => request.headers["idempotency-key"]),
    ).toEqual(["hr-sync-2026-11-15-hr-123", "hr-sync-2026-11-15-hr-123"]);
  });

  it("sends no Idempotency-Key or body on a GET", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, learnerReply());

    await clientOn(fake).learners.retrieve(LEARNER_ID);

    const [request] = fake.requestsTo(LEARNER_ROUTE);
    expect(request?.headers).not.toHaveProperty("idempotency-key");
    expect(request?.headers).not.toHaveProperty("content-type");
    expect(request?.body).toBeUndefined();
  });

  it.each<[string, ScriptStep, new (...args: never[]) => Error]>([
    ["a 5xx", unavailable, ApiError],
    ["a network error", networkFailure, ConnectionError],
  ])("does not retry a PATCH after %s", async (_, failure, errorClass) => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(UPDATE_ROUTE, failure, learnerReply());

    const error: unknown = await clientOn(fake)
      .learners.update(LEARNER_ID, { name: "Ana Example" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(errorClass);
    const attempts = fake.requestsTo(UPDATE_ROUTE);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.headers["content-type"]).toBe(
      "application/merge-patch+json",
    );
    expect(attempts[0]?.headers).not.toHaveProperty("idempotency-key");
  });

  it("retries createLaunchLink, safe by meaning, without an Idempotency-Key", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LAUNCH_LINK_ROUTE, networkFailure, launchLinkReply);

    const link = await clientOn(fake).learners.createLaunchLink(LEARNER_ID);

    expect(link.url).toBe("https://training.teachmehipaa.com/launch/ll_01JD9");
    const attempts = fake.requestsTo(LAUNCH_LINK_ROUTE);
    expect(attempts).toHaveLength(2);
    attempts.forEach((attempt) => {
      expect(attempt.headers).not.toHaveProperty("idempotency-key");
    });
  });
});
