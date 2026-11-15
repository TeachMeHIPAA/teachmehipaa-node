import { describe, expect, it } from "vitest";
import TeachMeHipaa, {
  AuthenticationError,
  staticTokenProvider,
} from "../src/index.js";
import { createFakeTransport } from "./support/fake-transport.js";
import {
  APP_BASIC_AUTHORIZATION,
  APP_ID,
  APP_SECRET,
  CLIENT_ID,
  CLIENT_SECRET,
  INTROSPECTION_ROUTE,
  LEARNER_ID,
  LEARNER_ROUTE,
  ORG_ID,
  TOKEN_ROUTE,
  learnerReply,
} from "./support/fixtures.js";

const unauthorized = {
  status: 401,
  headers: { "content-type": "application/problem+json" },
  json: { code: "unauthorized", title: "Unauthorized" },
};

describe("Static Access tokens", () => {
  it("sends the Access token as is and never calls the token endpoint", async () => {
    const fake = createFakeTransport().script(
      LEARNER_ROUTE,
      learnerReply(),
      learnerReply(),
    );
    const client = new TeachMeHipaa({
      tokenProvider: staticTokenProvider("access-token-from-elsewhere"),
      organizationId: ORG_ID,
      transport: fake.transport,
    });

    await client.learners.retrieve(LEARNER_ID);
    await client.learners.retrieve(LEARNER_ID);

    expect(fake.requestsTo(TOKEN_ROUTE)).toHaveLength(0);
    expect(
      fake.requestsTo(LEARNER_ROUTE).map((r) => r.headers.authorization),
    ).toEqual([
      "Bearer access-token-from-elsewhere",
      "Bearer access-token-from-elsewhere",
    ]);
  });

  it("raises an AuthenticationError on 401 without resending the same token", async () => {
    const fake = createFakeTransport().script(LEARNER_ROUTE, unauthorized);
    const client = new TeachMeHipaa({
      tokenProvider: staticTokenProvider("access-token-expired"),
      organizationId: ORG_ID,
      transport: fake.transport,
    });

    await expect(client.learners.retrieve(LEARNER_ID)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    expect(fake.requests).toHaveLength(1);
  });
});

describe("The tokenProvider option", () => {
  it("refuses a tokenProvider alongside clientId and clientSecret", () => {
    const options = {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      tokenProvider: staticTokenProvider("access-token"),
    };

    expect(() => new TeachMeHipaa(options as never)).toThrow(TypeError);
    expect(() => new TeachMeHipaa(options as never)).toThrow(
      /either tokenProvider or clientId and clientSecret/,
    );
  });

  it("refuses a tokenProvider without getAccessToken and invalidate", () => {
    expect(
      () =>
        new TeachMeHipaa({
          tokenProvider: {
            getAccessToken: () => Promise.resolve("access-token"),
          },
        } as never),
    ).toThrow(TypeError);
  });
});

describe("Partner-level tokens", () => {
  it("lets a Partner app's client credentials call partners.* without an Organization lookup", async () => {
    const partnerId = "ptn_01JD82ZX4C5V6B7N8M9Q0W1E2R";
    const route = `GET /v1/partners/${partnerId}`;
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, {
        json: {
          access_token: "access-token-partner",
          token_type: "Bearer",
          expires_in: 900,
          scope: "partner:orgs:read partner:orgs:write",
        },
      })
      .script(route, {
        json: {
          partnerId,
          name: "Reseller Co",
          appId: APP_ID,
          status: "active",
          maxChildOrgs: 50,
          childOrgCount: 3,
          createdAt: "2026-11-01T09:00:00.000Z",
        },
      });
    const client = new TeachMeHipaa({
      clientId: APP_ID,
      clientSecret: APP_SECRET,
      transport: fake.transport,
    });

    const partner = await client.partners.retrieve(partnerId);

    expect(partner.partnerId).toBe(partnerId);
    expect(fake.requestsTo(INTROSPECTION_ROUTE)).toHaveLength(0);
    expect(fake.requestsTo(TOKEN_ROUTE)[0]?.headers.authorization).toBe(
      APP_BASIC_AUTHORIZATION,
    );
    expect(fake.requestsTo(route)[0]?.headers.authorization).toBe(
      "Bearer access-token-partner",
    );
  });
});
