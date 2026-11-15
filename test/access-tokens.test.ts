import { describe, expect, it } from "vitest";
import TeachMeHipaa, { TeachMeHipaaError } from "../src/index.js";
import { createFakeClock } from "./support/fake-clock.js";
import {
  createFakeTransport,
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

const SECOND = 1000;

const flushPendingWork = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Access tokens", () => {
  it("mints exactly one Access token for two concurrent calls", async () => {
    let releaseToken: (reply: ScriptedReply) => void = () => undefined;
    const fake = createFakeTransport()
      .script(
        TOKEN_ROUTE,
        () => new Promise<ScriptedReply>((resolve) => (releaseToken = resolve)),
      )
      .script(LEARNER_ROUTE, learnerReply(), learnerReply());
    const client = new TeachMeHipaa({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      organizationId: ORG_ID,
      transport: fake.transport,
    });

    const both = Promise.all([
      client.learners.retrieve(LEARNER_ID),
      client.learners.retrieve(LEARNER_ID),
    ]);
    await flushPendingWork();
    releaseToken(tokenReply("jwt-1"));
    await both;

    expect(fake.requestsTo(TOKEN_ROUTE)).toHaveLength(1);
    expect(
      fake.requestsTo(LEARNER_ROUTE).map((r) => r.headers.authorization),
    ).toEqual(["Bearer jwt-1", "Bearer jwt-1"]);
  });

  it("re-mints the Access token 60 s before it expires", async () => {
    const clock = createFakeClock();
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply("jwt-1", 900), tokenReply("jwt-2", 900))
      .script(LEARNER_ROUTE, learnerReply(), learnerReply(), learnerReply());
    const client = new TeachMeHipaa({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      organizationId: ORG_ID,
      transport: fake.transport,
      clock,
    });

    await client.learners.retrieve(LEARNER_ID);
    clock.advance(839 * SECOND);
    await client.learners.retrieve(LEARNER_ID);
    clock.advance(1 * SECOND);
    await client.learners.retrieve(LEARNER_ID);

    expect(fake.requestsTo(TOKEN_ROUTE)).toHaveLength(2);
    expect(
      fake.requestsTo(LEARNER_ROUTE).map((r) => r.headers.authorization),
    ).toEqual(["Bearer jwt-1", "Bearer jwt-1", "Bearer jwt-2"]);
  });

  it("raises an OAuth error from the token endpoint and mints afresh on the next call", async () => {
    const fake = createFakeTransport()
      .script(
        TOKEN_ROUTE,
        {
          status: 401,
          headers: {
            "www-authenticate": 'Basic realm="TeachMeHIPAA API"',
            "x-request-id": "req-token-1",
          },
          json: {
            error: "invalid_client",
            error_description: "Client authentication failed.",
          },
        },
        tokenReply("jwt-2"),
      )
      .script(LEARNER_ROUTE, learnerReply());
    const client = new TeachMeHipaa({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      organizationId: ORG_ID,
      transport: fake.transport,
    });

    const error: unknown = await client.learners
      .retrieve(LEARNER_ID)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TeachMeHipaaError);
    expect(error).toMatchObject({
      status: 401,
      code: "invalid_client",
      detail: "Client authentication failed.",
      requestId: "req-token-1",
    });

    const learner = await client.learners.retrieve(LEARNER_ID);
    expect(learner.lastResponse.status).toBe(200);
    expect(fake.requestsTo(LEARNER_ROUTE)[0]?.headers.authorization).toBe(
      "Bearer jwt-2",
    );
  });

  it("requests only the Scopes the client was configured with", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, learnerReply());
    const client = new TeachMeHipaa({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      organizationId: ORG_ID,
      scopes: ["learners:write", "compliance:read"],
      transport: fake.transport,
    });

    await client.learners.retrieve(LEARNER_ID);

    const form = new URLSearchParams(fake.requestsTo(TOKEN_ROUTE)[0]?.body);
    expect([...form]).toEqual([
      ["grant_type", "client_credentials"],
      ["scope", "learners:write compliance:read"],
    ]);
  });
});
