import { describe, expect } from "vitest";
import { createFakeTransport } from "./support/fake-transport.js";
import {
  INTROSPECTION_ROUTE,
  LEARNER_ROUTE,
  ORG,
  TOKEN_ROUTE,
  introspectionReply,
  learnerBody,
  learnerReply,
  tokenReply,
} from "./support/fixtures.js";
import { learner, logged, page, sampleSuite } from "./readme/harness.js";

const { runs, runSample, checksEverySample } = sampleSuite("readme", [
  "README.md",
]);

describe("README", () => {
  checksEverySample({});

  runs("quickstart", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(INTROSPECTION_ROUTE, introspectionReply())
      .script(LEARNER_ROUTE, learnerReply())
      .script(
        `GET ${ORG}/learners`,
        page([learnerBody], "cursor-2"),
        page([learner(2)]),
      );

    await runSample("quickstart", fake);

    expect(logged).toEqual([
      ["Ana Example", "in_progress"],
      ["ana@example.com"],
      ["learner2@example.com"],
    ]);
    expect(fake.requests[0]?.url).toBe(
      "https://sandbox.api.tme.so/v1/auth/token",
    );
    const lists = fake.requestsTo(`GET ${ORG}/learners`);
    expect(
      Object.fromEntries(new URL(lists[0]?.url ?? "").searchParams),
    ).toEqual({ status: "in_progress" });
    expect(
      Object.fromEntries(new URL(lists[1]?.url ?? "").searchParams),
    ).toEqual({ status: "in_progress", cursor: "cursor-2" });
  });
});
