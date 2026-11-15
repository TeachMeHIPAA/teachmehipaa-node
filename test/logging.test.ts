import { describe, expect, it } from "vitest";
import TeachMeHipaa, { type Logger } from "../src/index.js";
import { createFakeClock } from "./support/fake-clock.js";
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

describe("Logging", () => {
  it("logs method, path, status, latency and request id, and nothing else", async () => {
    const clock = createFakeClock();
    const entries: { message: string; fields: unknown }[] = [];
    const logger: Logger = {
      debug: (message, fields) => entries.push({ message, fields }),
    };
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, () => {
        clock.advance(40);
        return tokenReply("jwt-secret-value");
      })
      .script(LEARNER_ROUTE, () => {
        clock.advance(120);
        return learnerReply({ "x-request-id": "req-77" });
      });
    const client = new TeachMeHipaa({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      organizationId: ORG_ID,
      transport: fake.transport,
      clock,
      logger,
    });

    await client.learners.retrieve(LEARNER_ID, { courseId: "hipaa-2026" });

    expect(entries).toEqual([
      {
        message: "teachmehipaa request",
        fields: {
          method: "POST",
          path: "/v1/auth/token",
          status: 200,
          latencyMs: 40,
          requestId: null,
        },
      },
      {
        message: "teachmehipaa request",
        fields: {
          method: "GET",
          path: `/v1/organizations/${ORG_ID}/learners/${LEARNER_ID}`,
          status: 200,
          latencyMs: 120,
          requestId: "req-77",
        },
      },
    ]);
    const logged = JSON.stringify(entries);
    [
      CLIENT_SECRET,
      "jwt-secret-value",
      learnerBody.email,
      "hipaa-2026",
    ].forEach((secret) => {
      expect(logged).not.toContain(secret);
    });
  });
});
