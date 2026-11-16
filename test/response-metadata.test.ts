import { describe, expect, it } from "vitest";
import TeachMeHipaa from "../src/index.js";
import { createFakeTransport } from "./support/fake-transport.js";
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

const ETAG =
  '"5d41402abc4b2a76b9719d911017c592ae0f3c1b6e4a3b0f9d8e7c6a5b4c3d2e"';
const REQUEST_ID = "1f0c6a2e-7b5d-4c3a-9e8f-0a1b2c3d4e5f";

describe("Response metadata", () => {
  it("exposes status, headers, request id and ETag on the returned Learner", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        LEARNER_ROUTE,
        learnerReply({ etag: ETAG, "x-request-id": REQUEST_ID }),
      );
    const client = new TeachMeHipaa({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      organizationId: ORG_ID,
      transport: fake.transport,
    });

    const learner = await client.learners.retrieve(LEARNER_ID);

    expect(learner.lastResponse.status).toBe(200);
    expect(learner.lastResponse.requestId).toBe(REQUEST_ID);
    expect(learner.lastResponse.etag).toBe(ETAG);
    expect(learner.lastResponse.headers).toMatchObject({
      etag: ETAG,
      "x-request-id": REQUEST_ID,
      "content-type": "application/json",
    });
  });

  it("keeps the metadata out of the Learner's own fields", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, learnerReply({ "x-request-id": REQUEST_ID }));
    const client = new TeachMeHipaa({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      organizationId: ORG_ID,
      transport: fake.transport,
    });

    const learner = await client.learners.retrieve(LEARNER_ID);

    expect(Object.keys(learner)).not.toContain("lastResponse");
    expect(JSON.parse(JSON.stringify(learner))).toEqual(learnerBody);
    expect(learner.lastResponse.etag).toBeNull();
  });
});
