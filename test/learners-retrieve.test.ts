import { describe, expect, it } from "vitest";
import TeachMeHipaa from "../src/index.js";
import { createFakeTransport } from "./support/fake-transport.js";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  INTROSPECTION_ROUTE,
  LEARNER_ID,
  LEARNER_ROUTE,
  ORG_ID,
  TOKEN_ROUTE,
  introspectionReply,
  learnerBody,
  learnerReply,
  tokenReply,
} from "./support/fixtures.js";

describe("learners.retrieve", () => {
  it("authenticates with client credentials, binds the Organization and returns the Learner", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply("access-token-1"))
      .script(INTROSPECTION_ROUTE, introspectionReply())
      .script(LEARNER_ROUTE, learnerReply());
    const client = new TeachMeHipaa({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      transport: fake.transport,
    });

    const learner = await client.learners.retrieve(LEARNER_ID);

    expect(learner).toEqual(learnerBody);

    const [tokenRequest, introspection, retrieve] = fake.requests;
    expect(tokenRequest?.url).toBe("https://api.tme.so/v1/auth/token");
    expect(tokenRequest?.headers["content-type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(tokenRequest?.headers.authorization).toBe(
      `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
    );
    expect(tokenRequest?.body).toBe("grant_type=client_credentials");

    expect(introspection?.url).toBe("https://api.tme.so/v1/auth/introspection");
    expect(introspection?.headers.authorization).toBe("Bearer access-token-1");

    expect(retrieve?.method).toBe("GET");
    expect(retrieve?.url).toBe(
      `https://api.tme.so/v1/organizations/org_acme/learners/${LEARNER_ID}`,
    );
    expect(retrieve?.headers.authorization).toBe("Bearer access-token-1");
    expect(retrieve?.headers.accept).toBe("application/json");
  });

  it("sends the Course as a query parameter and the per-request options", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, learnerReply());
    const client = new TeachMeHipaa({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      organizationId: ORG_ID,
      timeout: 30_000,
      transport: fake.transport,
    });

    await client.learners.retrieve(
      LEARNER_ID,
      { courseId: "hipaa 2026" },
      { requestId: "sync-job-42", timeout: 5_000 },
    );

    const [tokenRequest, retrieve] = fake.requests;
    expect(retrieve?.url).toBe(
      `https://api.tme.so/v1/organizations/${ORG_ID}/learners/${LEARNER_ID}?courseId=hipaa+2026`,
    );
    expect(retrieve?.headers["x-request-id"]).toBe("sync-job-42");
    expect(retrieve?.timeout).toBe(5_000);
    expect(tokenRequest?.timeout).toBe(30_000);
  });

  it("waits 80 s for a response unless told otherwise", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, learnerReply());
    const client = new TeachMeHipaa({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      organizationId: ORG_ID,
      transport: fake.transport,
    });

    await client.learners.retrieve(LEARNER_ID);

    expect(fake.requests.map((request) => request.timeout)).toEqual([
      80_000, 80_000,
    ]);
    expect(fake.requestsTo(LEARNER_ROUTE)[0]?.headers).not.toHaveProperty(
      "x-request-id",
    );
  });
});
