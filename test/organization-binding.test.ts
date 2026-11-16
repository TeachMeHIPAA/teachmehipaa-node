import { describe, expect, it } from "vitest";
import { TeachMeHipaaError } from "../src/index.js";
import { clientOn } from "./support/client.js";
import { createFakeTransport } from "./support/fake-transport.js";
import {
  INTROSPECTION_ROUTE,
  LEARNER_ID,
  LEARNER_ROUTE,
  TOKEN_ROUTE,
  introspectionReply,
  learnerReply,
  tokenReply,
} from "./support/fixtures.js";

describe("Organization binding", () => {
  it("resolves the Organization once and reuses it for later calls", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(INTROSPECTION_ROUTE, introspectionReply())
      .script(LEARNER_ROUTE, learnerReply(), learnerReply());
    const client = clientOn(fake, { organizationId: null });

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
    const client = clientOn(fake, { organizationId: null });

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
    const client = clientOn(fake, { organizationId: "org_given" });

    await client.learners.retrieve(LEARNER_ID);

    expect(fake.requestsTo(INTROSPECTION_ROUTE)).toHaveLength(0);
  });

  it("looks the Organization up again after a failed introspection", async () => {
    const unavailable = {
      status: 503,
      headers: { "content-type": "application/problem+json" },
      json: {
        title: "Service Unavailable",
        status: 503,
        code: "temporarily_unavailable",
      },
    };
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        INTROSPECTION_ROUTE,
        unavailable,
        unavailable,
        unavailable,
        introspectionReply(),
      )
      .script(LEARNER_ROUTE, learnerReply());
    const client = clientOn(fake, { organizationId: null });

    await expect(client.learners.retrieve(LEARNER_ID)).rejects.toMatchObject({
      status: 503,
      code: "temporarily_unavailable",
    });
    const learner = await client.learners.retrieve(LEARNER_ID);

    expect(learner.lastResponse.status).toBe(200);
    // Three tries for the first call (two retries), one for the second.
    expect(fake.requestsTo(INTROSPECTION_ROUTE)).toHaveLength(4);
  });

  it("explains that organizationId is needed when the Access token has no Organization", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(INTROSPECTION_ROUTE, introspectionReply(null));
    const client = clientOn(fake, { organizationId: null });

    const error: unknown = await client.learners
      .retrieve(LEARNER_ID)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TeachMeHipaaError);
    expect((error as TeachMeHipaaError).message).toMatch(/organizationId/);
    expect(fake.requestsTo(LEARNER_ROUTE)).toHaveLength(0);
  });
});
