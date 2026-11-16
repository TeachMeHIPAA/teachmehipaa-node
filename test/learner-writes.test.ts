import { describe, expect, it } from "vitest";
import { clientOn } from "./support/client.js";
import { createFakeTransport, textBody } from "./support/fake-transport.js";
import {
  LEARNER_ID,
  ORG,
  TOKEN_ROUTE,
  learnerBody,
  learnerReply,
  tokenReply,
} from "./support/fixtures.js";

const UPDATE_ROUTE = `PATCH ${ORG}/learners/${LEARNER_ID}`;
const ETAG = '"9f86d081"';

describe("Learner update as a merge patch", () => {
  it("leaves undefined fields out and sends an explicit null to clear one", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(UPDATE_ROUTE, learnerReply());
    const unchangedName: string | undefined = undefined;

    await clientOn(fake).learners.update(
      LEARNER_ID,
      { name: unchangedName, externalId: null },
      { ifMatch: ETAG },
    );

    const [request] = fake.requestsTo(UPDATE_ROUTE);
    expect(request?.headers["content-type"]).toBe(
      "application/merge-patch+json",
    );
    expect(textBody(request)).toBe('{"externalId":null}');
  });

  it("sends a set value and keeps the courseId query out of the patch", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(UPDATE_ROUTE, learnerReply());

    await clientOn(fake).learners.update(
      LEARNER_ID,
      { name: "Ana B. Example", courseId: "hipaa-2026" },
      { ifMatch: ETAG },
    );

    const [request] = fake.requestsTo(UPDATE_ROUTE);
    expect(request?.url).toBe(
      `https://api.tme.so${ORG}/learners/${LEARNER_ID}?courseId=hipaa-2026`,
    );
    expect(textBody(request)).toBe('{"name":"Ana B. Example"}');
  });
});

describe("Learner write results", () => {
  const CREATE_ROUTE = `POST ${ORG}/learners`;
  const UPSERT_ROUTE = `PUT ${ORG}/learners/by-external-id/hr-123`;
  /** `dev#/components/schemas/LearnerCreated` with `delivery: "none"`. */
  const createdBody = {
    ...learnerBody,
    status: "not_started",
    startedAt: null,
    delivery: "none",
    joinUrl: "https://tme.so/j/7QX2",
  };

  it("creates a Learner: created is true and the 201 carries delivery and joinUrl", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(CREATE_ROUTE, {
        status: 201,
        json: createdBody,
        headers: { etag: ETAG },
      });

    const result = await clientOn(fake).learners.create({
      email: "ana@example.com",
      delivery: "none",
    });

    expect(result.created).toBe(true);
    expect(result.delivery).toBe("none");
    expect(result.joinUrl).toBe("https://tme.so/j/7QX2");
    expect(result.lastResponse.etag).toBe(ETAG);
  });

  it("finds the Learner already there: created is false with no delivery or joinUrl", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(CREATE_ROUTE, { status: 200, json: learnerBody });

    const result = await clientOn(fake).learners.create({
      email: "ana@example.com",
    });

    expect(result.created).toBe(false);
    expect(result).not.toHaveProperty("delivery");
    expect(result).not.toHaveProperty("joinUrl");
    expect(result.learnerId).toBe(LEARNER_ID);
  });

  it("tells a replayed upsert (200) from the first one (201)", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        UPSERT_ROUTE,
        { status: 201, json: createdBody },
        { status: 200, json: learnerBody },
      );
    const client = clientOn(fake);
    const params = { email: "ana@example.com", delivery: "none" } as const;

    const first = await client.learners.upsertByExternalId("hr-123", params);
    const replay = await client.learners.upsertByExternalId("hr-123", params);

    expect([first.created, first.joinUrl]).toEqual([
      true,
      "https://tme.so/j/7QX2",
    ]);
    expect([replay.created, replay.joinUrl]).toEqual([false, undefined]);
  });
});
