import { describe, expect, it } from "vitest";
import TeachMeHipaa, {
  type Clock,
  OperationFailedError,
  OperationTimeoutError,
  TeachMeHipaaError,
  operationIdFromName,
} from "../src/index.js";
import { createFakeClock } from "./support/fake-clock.js";
import {
  createFakeTransport,
  type FakeTransport,
} from "./support/fake-transport.js";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  ORG_ID,
  TOKEN_ROUTE,
  tokenReply,
} from "./support/fixtures.js";

const ORG = `/v1/organizations/${ORG_ID}`;
const OPERATION_ID = "0b7d4a8e-5c1f-4e2a-9d3b-6f8a1c2e4b7d";
/** Research `api-sdk-surface.md` §8: `organizations/{orgId}/operations/{operationId}`. */
const OPERATION_NAME = `organizations/${ORG_ID}/operations/${OPERATION_ID}`;
const POLL_ROUTE = `GET ${ORG}/operations/${OPERATION_ID}`;
const ENROLLMENTS_EXPORT_ROUTE = `POST ${ORG}/enrollments:export`;
const SUBSCRIPTION_ID = "whs_01JD8K2M4N6P8R0T2V4X6Z8B0D";
const TEST_DELIVERY_ROUTE = `POST ${ORG}/webhook-subscriptions/${SUBSCRIPTION_ID}:test`;

/** A Test delivery's 202: pending until the webhook worker settles it. */
const pendingBody = { name: OPERATION_NAME, done: false };
/** The worker's settle on a 2xx from the endpoint (§8: `response._tag`). */
const sentBody = {
  name: OPERATION_NAME,
  done: true,
  response: { _tag: "sent", responseStatus: 200 },
};

/** `dev#/components/schemas/Operation`: a done Operation with a problem. */
const failedBody = {
  name: OPERATION_NAME,
  done: true,
  error: {
    title: "Temporarily unavailable",
    status: 503,
    code: "temporarily_unavailable",
    detail: "Webhook delivery is paused. Try again later.",
  },
};

/**
 * An export's 202: a done Operation whose `response` is the monorepo's
 * `ExportArtifact` (`api-contracts` `bulk.schemas.ts`), the CSV in base64.
 */
const exportOperationBody = {
  name: OPERATION_NAME,
  done: true,
  metadata: { kind: "enrollments:export" },
  response: {
    format: "csv",
    contentType: "text/csv; charset=utf-8",
    filename: `enrollments-${ORG_ID}.csv`,
    rowCount: 2,
    dataBase64:
      "bGVhcm5lcklkLGVtYWlsLG5hbWUNCnN1Yl8wMUpEODBBQjJDM0Q0RTVGNkc3SDhKOUswTSxhbmFAZXhhbXBsZS5jb20sIkV4YW1wbGUsIEFuYSINCnN1Yl8wMUpEODBBQjJDM0Q0RTVGNkc3SDhKOUswTixqb3NlQGV4YW1wbGUuY29tLEpvc8OpIE7DusOxZXoNCg==",
  },
};

/** What `exportOperationBody.response.dataBase64` decodes to: RFC 4180, CRLF, UTF-8. */
const EXPORTED_CSV =
  'learnerId,email,name\r\nsub_01JD80AB2C3D4E5F6G7H8J9K0M,ana@example.com,"Example, Ana"\r\nsub_01JD80AB2C3D4E5F6G7H8J9K0N,jose@example.com,José Núñez\r\n';

const clientOn = (fake: FakeTransport, clock: Clock = createFakeClock()) =>
  new TeachMeHipaa({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    organizationId: ORG_ID,
    transport: fake.transport,
    clock,
    maxRetries: 0,
  });

describe("Operation.wait", () => {
  it("returns a done Operation without sending a request", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(ENROLLMENTS_EXPORT_ROUTE, {
        status: 202,
        json: exportOperationBody,
      });
    const clock = createFakeClock();

    const operation = await clientOn(fake, clock).enrollments.export({
      format: "csv",
    });
    const finished = await operation.wait();

    expect(finished).toEqual(exportOperationBody);
    expect(finished.lastResponse.status).toBe(202);
    expect(fake.requests).toHaveLength(2);
    expect(clock.sleeps).toEqual([]);
  });

  it("polls a pending Operation until it is done", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(TEST_DELIVERY_ROUTE, { status: 202, json: pendingBody })
      .script(
        POLL_ROUTE,
        { json: pendingBody },
        { json: pendingBody },
        { json: sentBody, headers: { "x-request-id": "req_poll_3" } },
      );
    const clock = createFakeClock();

    const operation = await clientOn(fake, clock).webhookSubscriptions.test(
      SUBSCRIPTION_ID,
    );
    const finished = await operation.wait();

    expect(operation.done).toBe(false);
    expect(finished).toEqual(sentBody);
    expect(finished.lastResponse.requestId).toBe("req_poll_3");
    expect(finished.response?._tag).toBe("sent");
    expect(fake.requestsTo(POLL_ROUTE)).toHaveLength(3);
    expect(clock.sleeps).toHaveLength(3);
  });

  it("doubles the poll interval from 1 s with jitter up to a 10 s cap", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(TEST_DELIVERY_ROUTE, { status: 202, json: pendingBody })
      .script(
        POLL_ROUTE,
        ...Array.from({ length: 7 }, () => ({ json: pendingBody })),
        { json: sentBody },
      );
    const clock = createFakeClock();

    const operation = await clientOn(fake, clock).webhookSubscriptions.test(
      SUBSCRIPTION_ID,
    );
    await operation.wait();

    // Ceilings 1, 2, 4, 8, 10, 10, 10, 10 s; jitter keeps each within 50–100 %
    // of its ceiling, and never below the 1 s interval.
    const ranges = [
      [1000, 1000],
      [1000, 2000],
      [2000, 4000],
      [4000, 8000],
      [5000, 10000],
      [5000, 10000],
      [5000, 10000],
      [5000, 10000],
    ];
    expect(clock.sleeps).toHaveLength(ranges.length);
    clock.sleeps.forEach((sleep, index) => {
      const [low = 0, high = 0] = ranges[index] ?? [];
      expect(sleep).toBeGreaterThanOrEqual(low);
      expect(sleep).toBeLessThanOrEqual(high);
    });
  });

  it("starts from the interval it is given", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(TEST_DELIVERY_ROUTE, { status: 202, json: pendingBody })
      .script(POLL_ROUTE, { json: pendingBody }, { json: sentBody });
    const clock = createFakeClock();

    const operation = await clientOn(fake, clock).webhookSubscriptions.test(
      SUBSCRIPTION_ID,
    );
    await operation.wait({ interval: 250 });

    expect(clock.sleeps[0]).toBe(250);
    expect(clock.sleeps[1]).toBeGreaterThanOrEqual(250);
    expect(clock.sleeps[1]).toBeLessThanOrEqual(500);
  });

  it("raises OperationTimeoutError once the timeout has passed, polling one last time at the deadline", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(TEST_DELIVERY_ROUTE, { status: 202, json: pendingBody })
      .script(
        POLL_ROUTE,
        ...Array.from({ length: 10 }, () => ({ json: pendingBody })),
      );
    const clock = createFakeClock();
    const operation = await clientOn(fake, clock).webhookSubscriptions.test(
      SUBSCRIPTION_ID,
    );

    const error: unknown = await operation
      .wait({ timeout: 5000 })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OperationTimeoutError);
    expect(error).toBeInstanceOf(TeachMeHipaaError);
    expect(error).toMatchObject({
      name: "OperationTimeoutError",
      message: `Operation ${OPERATION_NAME} was not done after 5000 ms`,
      operation: pendingBody,
    });
    expect(clock.sleeps.reduce((total, sleep) => total + sleep, 0)).toBe(5000);
    expect(fake.requestsTo(POLL_ROUTE)).toHaveLength(clock.sleeps.length);
  });

  it("raises OperationFailedError with the problem when the Operation finishes with an error", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(TEST_DELIVERY_ROUTE, { status: 202, json: pendingBody })
      .script(POLL_ROUTE, {
        json: failedBody,
        headers: { "x-request-id": "req_poll_1" },
      });
    const operation =
      await clientOn(fake).webhookSubscriptions.test(SUBSCRIPTION_ID);

    const error: unknown = await operation
      .wait()
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(OperationFailedError);
    expect(error).toBeInstanceOf(TeachMeHipaaError);
    expect(error).toMatchObject({
      name: "OperationFailedError",
      message:
        "Temporarily unavailable: Webhook delivery is paused. Try again later.",
      status: 503,
      code: "temporarily_unavailable",
      title: "Temporarily unavailable",
      detail: "Webhook delivery is paused. Try again later.",
      errors: [],
      requestId: "req_poll_1",
      raw: failedBody.error,
      operation: failedBody,
    });
  });

  it("raises OperationFailedError for an Operation that was already done with an error, without a request", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(TEST_DELIVERY_ROUTE, { status: 202, json: failedBody });
    const operation =
      await clientOn(fake).webhookSubscriptions.test(SUBSCRIPTION_ID);

    await expect(operation.wait()).rejects.toThrow(OperationFailedError);
    expect(fake.requestsTo(POLL_ROUTE)).toHaveLength(0);
  });

  it("stops mid-sleep when the signal aborts, rejecting with its reason", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(TEST_DELIVERY_ROUTE, { status: 202, json: pendingBody });
    const sleeps: number[] = [];
    const neverWakes: Clock = {
      now: () => Date.UTC(2026, 10, 15, 12),
      sleep: (milliseconds) => {
        sleeps.push(milliseconds);
        return new Promise(() => undefined);
      },
    };
    const operation = await clientOn(
      fake,
      neverWakes,
    ).webhookSubscriptions.test(SUBSCRIPTION_ID);
    const controller = new AbortController();
    const shutdown = new Error("worker shutting down");

    const waiting = operation.wait({ signal: controller.signal });
    await Promise.resolve();
    controller.abort(shutdown);

    await expect(waiting).rejects.toBe(shutdown);
    expect(sleeps).toEqual([1000]);
    expect(fake.requestsTo(POLL_ROUTE)).toHaveLength(0);
  });

  it("stops after a poll in flight when the signal aborts during it", async () => {
    const controller = new AbortController();
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(TEST_DELIVERY_ROUTE, { status: 202, json: pendingBody })
      .script(POLL_ROUTE, () => {
        controller.abort();
        return { json: pendingBody };
      });
    const clock = createFakeClock();
    const operation = await clientOn(fake, clock).webhookSubscriptions.test(
      SUBSCRIPTION_ID,
    );

    const error: unknown = await operation
      .wait({ signal: controller.signal })
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ name: "AbortError" });
    expect(clock.sleeps).toEqual([1000]);
    expect(fake.requestsTo(POLL_ROUTE)).toHaveLength(1);
  });

  it("rejects at once, without a request, when the signal has already aborted", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(TEST_DELIVERY_ROUTE, { status: 202, json: pendingBody });
    const clock = createFakeClock();
    const operation = await clientOn(fake, clock).webhookSubscriptions.test(
      SUBSCRIPTION_ID,
    );

    await expect(
      operation.wait({ signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(clock.sleeps).toEqual([]);
    expect(fake.requestsTo(POLL_ROUTE)).toHaveLength(0);
  });
});

describe("Operation.exportResult", () => {
  it("returns the CSV text, file name and row count of an export", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(ENROLLMENTS_EXPORT_ROUTE, {
        status: 202,
        json: exportOperationBody,
      });

    const operation = await clientOn(fake).enrollments.export({
      format: "csv",
    });

    expect(operation.exportResult()).toEqual({
      csv: EXPORTED_CSV,
      filename: `enrollments-${ORG_ID}.csv`,
      rowCount: 2,
    });
  });

  it.each(["certificates", "learners"])(
    "reads a %s export the same way",
    async (resource) => {
      const fake = createFakeTransport()
        .script(TOKEN_ROUTE, tokenReply())
        .script(`POST ${ORG}/${resource}:export`, {
          status: 202,
          json: exportOperationBody,
        });
      const client = clientOn(fake);

      const operation =
        resource === "certificates"
          ? await client.certificates.export({ format: "csv" })
          : await client.learners.export({
              courseId: "hipaa-2026",
              format: "csv",
            });

      expect(operation.exportResult().csv).toBe(EXPORTED_CSV);
    },
  );

  it("reads an export Operation retrieved by id", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(POLL_ROUTE, { json: exportOperationBody });

    const operation = await clientOn(fake).operations.retrieve(OPERATION_ID);

    expect(operation.exportResult().csv).toBe(EXPORTED_CSV);
  });

  it("refuses an Operation that is not done", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(POLL_ROUTE, { json: pendingBody });

    const operation = await clientOn(fake).operations.retrieve(OPERATION_ID);

    expect(() => operation.exportResult()).toThrow(
      new TypeError(
        `TeachMeHipaa: Operation ${OPERATION_NAME} is not done; call wait() first`,
      ),
    );
  });

  it("refuses an Operation that is not an export", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(POLL_ROUTE, { json: sentBody });

    const operation = await clientOn(fake).operations.retrieve(OPERATION_ID);

    expect(() => operation.exportResult()).toThrow(
      new TypeError(
        `TeachMeHipaa: Operation ${OPERATION_NAME} did not produce a CSV export`,
      ),
    );
  });

  it("raises OperationFailedError for an Operation that failed", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(POLL_ROUTE, { json: failedBody });

    const operation = await clientOn(fake).operations.retrieve(OPERATION_ID);

    expect(() => operation.exportResult()).toThrow(OperationFailedError);
  });
});

describe("operationIdFromName", () => {
  it("reads the operationId that operations.retrieve takes from an Operation name", () => {
    expect(
      operationIdFromName(
        "organizations/org_acme/operations/0b7d4a8e-5c1f-4e2a-9d3b-6f8a1c2e4b7d",
      ),
    ).toBe("0b7d4a8e-5c1f-4e2a-9d3b-6f8a1c2e4b7d");
  });

  it.each([
    "0b7d4a8e-5c1f-4e2a-9d3b-6f8a1c2e4b7d",
    "organizations/org_acme/operations/",
    "organizations/org_acme/learners/sub_01JD80AB2C3D4E5F6G7H8J9K0M",
    "organizations/org_acme/operations/op_1/extra",
  ])("rejects %j", (name) => {
    expect(() => operationIdFromName(name)).toThrow(TypeError);
  });
});
