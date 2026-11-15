import { describe, expect, it } from "vitest";
import TeachMeHipaa, {
  ApiError,
  AuthenticationError,
  ConnectionError,
  OAuthError,
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
  learnerReply,
  tokenReply,
} from "./support/fixtures.js";

/** What the API answers for a revoked or expired Access token. */
const unauthorized: ScriptedReply = {
  status: 401,
  headers: {
    "content-type": "application/problem+json",
    "www-authenticate":
      'Bearer realm="TeachMeHIPAA API", error="invalid_token"',
  },
  json: { title: "Unauthorized", status: 401, code: "unauthorized" },
};

const unavailable: ScriptedReply = {
  status: 503,
  headers: { "content-type": "application/problem+json" },
  json: {
    title: "Service Unavailable",
    status: 503,
    code: "temporarily_unavailable",
  },
};

const networkFailure: ScriptStep = () => {
  throw new TypeError("fetch failed");
};

const clientOn = (
  fake: FakeTransport,
  options: Partial<TeachMeHipaaOptions> = {},
) =>
  new TeachMeHipaa({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    organizationId: ORG_ID,
    transport: fake.transport,
    clock: createFakeClock(),
    ...options,
  });

const authorizations = (fake: FakeTransport): readonly (string | undefined)[] =>
  fake.requestsTo(LEARNER_ROUTE).map((r) => r.headers.authorization);

const flushPendingWork = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("401 replay", () => {
  it("re-mints the Access token once and replays the request", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply("jwt-1"), tokenReply("jwt-2"))
      .script(LEARNER_ROUTE, unauthorized, learnerReply());

    const learner = await clientOn(fake).learners.retrieve(LEARNER_ID);

    expect(learner.lastResponse.status).toBe(200);
    expect(authorizations(fake)).toEqual(["Bearer jwt-1", "Bearer jwt-2"]);
  });

  it("does not count the replay as a retry", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply("jwt-1"), tokenReply("jwt-2"))
      .script(LEARNER_ROUTE, unauthorized, learnerReply());

    const learner = await clientOn(fake, { maxRetries: 0 }).learners.retrieve(
      LEARNER_ID,
    );

    expect(learner.lastResponse.status).toBe(200);
  });

  it("still has every retry left after a replay", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply("jwt-1"), tokenReply("jwt-2"))
      .script(
        LEARNER_ROUTE,
        unauthorized,
        unavailable,
        unavailable,
        learnerReply(),
      );

    await clientOn(fake).learners.retrieve(LEARNER_ID);

    expect(authorizations(fake)).toEqual([
      "Bearer jwt-1",
      "Bearer jwt-2",
      "Bearer jwt-2",
      "Bearer jwt-2",
    ]);
  });

  it("replays only once and then raises an AuthenticationError", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply("jwt-1"), tokenReply("jwt-2"))
      .script(LEARNER_ROUTE, unauthorized, unauthorized);

    const error: unknown = await clientOn(fake)
      .learners.retrieve(LEARNER_ID)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AuthenticationError);
    expect(fake.requestsTo(TOKEN_ROUTE)).toHaveLength(2);
    expect(fake.requestsTo(LEARNER_ROUTE)).toHaveLength(2);
  });

  it("re-mints once when concurrent calls hit 401 with the same token", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply("jwt-1"), tokenReply("jwt-2"))
      .script(
        LEARNER_ROUTE,
        unauthorized,
        unauthorized,
        learnerReply(),
        learnerReply(),
      );
    const client = clientOn(fake);
    await flushPendingWork();

    await Promise.all([
      client.learners.retrieve(LEARNER_ID),
      client.learners.retrieve(LEARNER_ID),
    ]);

    expect(fake.requestsTo(TOKEN_ROUTE)).toHaveLength(2);
    expect(authorizations(fake)).toEqual([
      "Bearer jwt-1",
      "Bearer jwt-1",
      "Bearer jwt-2",
      "Bearer jwt-2",
    ]);
  });

  it("rejects the call when the re-mint fails, instead of leaving it pending", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply("jwt-1"), {
        status: 401,
        json: {
          error: "invalid_client",
          error_description: "The API client was revoked.",
        },
      })
      .script(LEARNER_ROUTE, unauthorized);

    const error: unknown = await clientOn(fake)
      .learners.retrieve(LEARNER_ID)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OAuthError);
    expect(error).toMatchObject({ code: "invalid_client" });
  });
});

describe("Access token mints", () => {
  it.each<[string, ScriptStep]>([
    ["a network error", networkFailure],
    ["a 5xx", unavailable],
  ])("retries a client-credentials mint after %s", async (_, failure) => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, failure, tokenReply("jwt-1"))
      .script(LEARNER_ROUTE, learnerReply());

    await clientOn(fake).learners.retrieve(LEARNER_ID);

    expect(fake.requestsTo(TOKEN_ROUTE)).toHaveLength(2);
    expect(authorizations(fake)).toEqual(["Bearer jwt-1"]);
  });

  it("does not retry a mint the token endpoint refused", async () => {
    const fake = createFakeTransport().script(TOKEN_ROUTE, {
      status: 400,
      json: { error: "invalid_scope" },
    });

    await expect(
      clientOn(fake).learners.retrieve(LEARNER_ID),
    ).rejects.toBeInstanceOf(OAuthError);
    expect(fake.requestsTo(TOKEN_ROUTE)).toHaveLength(1);
  });

  it("rejects the call once mint retries run out, without retrying the request on top", async () => {
    const fake = createFakeTransport().script(
      TOKEN_ROUTE,
      networkFailure,
      networkFailure,
      networkFailure,
    );

    const error: unknown = await clientOn(fake)
      .learners.retrieve(LEARNER_ID)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ConnectionError);
    expect(fake.requestsTo(TOKEN_ROUTE)).toHaveLength(3);
    expect(fake.requestsTo(LEARNER_ROUTE)).toHaveLength(0);
  });

  it("raises an HTML page from the token endpoint as an ApiError", async () => {
    const fake = createFakeTransport().script(TOKEN_ROUTE, {
      status: 200,
      headers: { "content-type": "text/html" },
      body: "<html>wrong host</html>",
    });

    await expect(
      clientOn(fake).learners.retrieve(LEARNER_ID),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
