import { describe, expect, it } from "vitest";
import TeachMeHipaa, { PreconditionFailedError } from "../src/index.js";
import {
  createFakeTransport,
  type FakeTransport,
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

const ORG = `/v1/organizations/${ORG_ID}`;
const UPDATE_ROUTE = `PATCH ${ORG}/learners/${LEARNER_ID}`;
const SUBSCRIPTION_ID = "whs_01JD8D";
const SUBSCRIPTION_ROUTE = `PATCH ${ORG}/webhook-subscriptions/${SUBSCRIPTION_ID}`;

/** Learners use a quoted SHA-256 hex strong tag (research §5). */
const LEARNER_ETAG =
  '"9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"';

/** Rev-based resources use a quoted revision (research §5). */
const COURSE_ETAG = '"7"';
const COURSE_ID = "hipaa-2026";
const COURSE_ROUTE = `GET /v1/courses/${COURSE_ID}`;

/** `dev#/components/schemas/CourseDto`. */
const courseBody = {
  courseId: COURSE_ID,
  title: "HIPAA Training 2026",
  courseVersion: "2026.1",
  passingThreshold: 80,
};

/** `dev#/components/schemas/Problem`, as `conditional.core.ts` sends them. */
const preconditionFailed = {
  status: 412,
  headers: { "content-type": "application/problem+json" },
  json: {
    title: "Precondition failed",
    status: 412,
    code: "precondition_failed",
    detail: "The resource has changed since you read it.",
  },
};
const preconditionRequired = {
  status: 428,
  headers: { "content-type": "application/problem+json" },
  json: {
    title: "Precondition required",
    status: 428,
    code: "precondition_required",
    detail: "Send If-Match with the resource's current ETag.",
  },
};

const clientOn = (fake: FakeTransport) =>
  new TeachMeHipaa({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    organizationId: ORG_ID,
    transport: fake.transport,
  });

describe("Conditional writes", () => {
  it("sends ifMatch as If-Match on a Learner update", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(UPDATE_ROUTE, learnerReply({ etag: '"next"' }));

    const learner = await clientOn(fake).learners.update(
      LEARNER_ID,
      { name: "Ana Example" },
      { ifMatch: LEARNER_ETAG },
    );

    expect(learner.lastResponse.etag).toBe('"next"');
    expect(fake.requestsTo(UPDATE_ROUTE)[0]?.headers["if-match"]).toBe(
      LEARNER_ETAG,
    );
  });

  it("takes the ETag from a Learner it returned: ifMatch: learner", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, learnerReply({ etag: LEARNER_ETAG }))
      .script(UPDATE_ROUTE, learnerReply());
    const client = clientOn(fake);

    const learner = await client.learners.retrieve(LEARNER_ID);
    await client.learners.update(
      LEARNER_ID,
      { externalId: null },
      { ifMatch: learner },
    );

    expect(fake.requestsTo(UPDATE_ROUTE)[0]?.headers["if-match"]).toBe(
      LEARNER_ETAG,
    );
  });

  it("refuses an object whose response had no ETag, before sending anything", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, learnerReply());
    const client = clientOn(fake);
    const learner = await client.learners.retrieve(LEARNER_ID);

    await expect(
      client.learners.offboard(LEARNER_ID, {}, { ifMatch: learner }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(
      fake.requestsTo(`POST ${ORG}/learners/${LEARNER_ID}:offboard`),
    ).toEqual([]);
  });

  it("raises PreconditionFailedError when the Learner changed since it was read (412)", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(UPDATE_ROUTE, preconditionFailed);

    const update = clientOn(fake).learners.update(
      LEARNER_ID,
      { name: "Ana Example" },
      { ifMatch: LEARNER_ETAG },
    );

    await expect(update).rejects.toBeInstanceOf(PreconditionFailedError);
    await expect(update).rejects.toMatchObject({
      status: 412,
      code: "precondition_failed",
    });
    expect(fake.requestsTo(UPDATE_ROUTE)).toHaveLength(1);
  });

  it("compiles without ifMatch and raises PreconditionFailedError for the API's 428", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(SUBSCRIPTION_ROUTE, preconditionRequired);

    const update = clientOn(fake).webhookSubscriptions.update(SUBSCRIPTION_ID, {
      enabled: false,
    });

    await expect(update).rejects.toBeInstanceOf(PreconditionFailedError);
    await expect(update).rejects.toMatchObject({
      status: 428,
      code: "precondition_required",
    });
    expect(fake.requestsTo(SUBSCRIPTION_ROUTE)[0]?.headers).not.toHaveProperty(
      "if-match",
    );
  });
});

describe("Conditional reads", () => {
  it("sends ifNoneMatch as If-None-Match and resolves a 304 as NotModified", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(COURSE_ROUTE, {
        status: 304,
        headers: { etag: COURSE_ETAG, "x-request-id": "req_304" },
      });

    const result = await clientOn(fake).courses.retrieve(COURSE_ID, {
      ifNoneMatch: COURSE_ETAG,
    });

    expect(result).toEqual({ notModified: true });
    expect(result.lastResponse).toMatchObject({
      status: 304,
      etag: COURSE_ETAG,
      requestId: "req_304",
    });
    expect(fake.requestsTo(COURSE_ROUTE)[0]?.headers["if-none-match"]).toBe(
      COURSE_ETAG,
    );
  });

  it("returns the object when it changed, taking the ETag from the copy you hold", async () => {
    const changed = { ...courseBody, courseVersion: "2026.2" };
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(COURSE_ROUTE, {
        json: courseBody,
        headers: { etag: COURSE_ETAG },
      })
      .script(COURSE_ROUTE, { json: changed, headers: { etag: '"8"' } });
    const client = clientOn(fake);
    const cached = await client.courses.retrieve(COURSE_ID);

    const result = await client.courses.retrieve(COURSE_ID, {
      ifNoneMatch: cached,
    });

    if ("notModified" in result) {
      throw new Error("Expected the changed Course");
    }
    expect(result.courseVersion).toBe("2026.2");
    expect(fake.requestsTo(COURSE_ROUTE)[1]?.headers["if-none-match"]).toBe(
      COURSE_ETAG,
    );
  });

  it("still types a plain retrieve as the object alone", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(COURSE_ROUTE, { json: courseBody });

    const course = await clientOn(fake).courses.retrieve(COURSE_ID, {
      timeout: 5000,
    });

    expect(course.title).toBe("HIPAA Training 2026");
    expect(fake.requestsTo(COURSE_ROUTE)[0]?.headers).not.toHaveProperty(
      "if-none-match",
    );
  });
});
