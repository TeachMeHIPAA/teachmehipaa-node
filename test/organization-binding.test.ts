import { describe, expect, it } from "vitest";
import TeachMeHipaa, { TeachMeHipaaError } from "../src/index.js";
import { createFakeTransport } from "./support/fake-transport.js";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  INTROSPECTION_ROUTE,
  LEARNER_ID,
  LEARNER_ROUTE,
  TOKEN_ROUTE,
  introspectionReply,
  learnerReply,
  tokenReply,
} from "./support/fixtures.js";

const clientOn = (
  fake: ReturnType<typeof createFakeTransport>,
  organizationId?: string,
) =>
  new TeachMeHipaa({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    transport: fake.transport,
    ...(organizationId === undefined ? {} : { organizationId }),
  });

describe("Organization binding", () => {
  it("resolves the Organization once and reuses it for later calls", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(INTROSPECTION_ROUTE, introspectionReply())
      .script(LEARNER_ROUTE, learnerReply(), learnerReply());
    const client = clientOn(fake);

    await client.learners.retrieve(LEARNER_ID);
    await client.learners.retrieve(LEARNER_ID);

    expect(fake.requestsTo(INTROSPECTION_ROUTE)).toHaveLength(1);
    expect(fake.requestsTo(LEARNER_ROUTE)).toHaveLength(2);
  });

  it("shares one introspection call between concurrent first calls", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(INTROSPECTION_ROUTE, introspectionReply())
      .script(LEARNER_ROUTE, learnerReply(), learnerReply());
    const client = clientOn(fake);

    await Promise.all([
      client.learners.retrieve(LEARNER_ID),
      client.learners.retrieve(LEARNER_ID),
    ]);

    expect(fake.requestsTo(INTROSPECTION_ROUTE)).toHaveLength(1);
  });

  it("uses an explicit organizationId without calling introspection", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        `GET /v1/organizations/org_given/learners/${LEARNER_ID}`,
        learnerReply(),
      );
    const client = clientOn(fake, "org_given");

    await client.learners.retrieve(LEARNER_ID);

    expect(fake.requestsTo(INTROSPECTION_ROUTE)).toHaveLength(0);
  });

  it("looks the Organization up again after a failed introspection", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(INTROSPECTION_ROUTE, {
        status: 503,
        headers: { "content-type": "application/problem+json" },
        json: {
          title: "Service Unavailable",
          status: 503,
          code: "temporarily_unavailable",
        },
      })
      .script(INTROSPECTION_ROUTE, introspectionReply())
      .script(LEARNER_ROUTE, learnerReply());
    const client = clientOn(fake);

    await expect(client.learners.retrieve(LEARNER_ID)).rejects.toMatchObject({
      status: 503,
      code: "temporarily_unavailable",
    });
    const learner = await client.learners.retrieve(LEARNER_ID);

    expect(learner.lastResponse.status).toBe(200);
    expect(fake.requestsTo(INTROSPECTION_ROUTE)).toHaveLength(2);
  });

  it("explains that organizationId is needed when the Access token has no Organization", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(INTROSPECTION_ROUTE, introspectionReply(null));
    const client = clientOn(fake);

    const error: unknown = await client.learners
      .retrieve(LEARNER_ID)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TeachMeHipaaError);
    expect((error as TeachMeHipaaError).message).toMatch(/organizationId/);
    expect(fake.requestsTo(LEARNER_ROUTE)).toHaveLength(0);
  });
});
