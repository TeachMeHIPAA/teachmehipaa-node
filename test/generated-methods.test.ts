import { describe, expect, it } from "vitest";
import TeachMeHipaa, { ApiError } from "../src/index.js";
import {
  createFakeTransport,
  textBody,
  type FakeTransport,
  type ScriptedReply,
} from "./support/fake-transport.js";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  LEARNER_ID,
  LEARNER_ROUTE,
  ORG_ID,
  TOKEN_ROUTE,
  learnerBody,
  tokenReply,
} from "./support/fixtures.js";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const ENROLLMENT_ID = "enr_01JD8C";
const SUBSCRIPTION_ID = "whs_01JD8D";
const PARTNER_ID = "ptn_01JD8E";
const CERTIFICATE_ID = "cert_01JD8F";

const ORG = `/v1/organizations/${ORG_ID}`;

/** `dev#/components/schemas/EnrollmentDto`. */
const enrollmentBody = {
  enrollmentId: ENROLLMENT_ID,
  subjectId: LEARNER_ID,
  courseId: "hipaa-2026",
  orgId: ORG_ID,
  status: "CANCELLED",
  effectiveStatus: "CANCELLED",
  archived: false,
  cycle: 0,
  rev: 3,
  invitedAt: "2026-11-01T09:00:00.000Z",
  startedAt: null,
  completedAt: null,
  certifiedAt: null,
  expiresAt: null,
  certificateId: null,
};

/** `dev#/components/schemas/WebhookSubscriptionDto`. */
const subscriptionBody = {
  subscriptionId: SUBSCRIPTION_ID,
  endpointUrl: "https://hr.example.com/hooks/tmh",
  eventTypes: ["learner.certified"],
  enabled: false,
  description: null,
  seatsLowThreshold: 5,
  secretKeyId: "whk_01JD8G",
  createdAt: "2026-11-10T08:00:00.000Z",
  rev: 2,
};

const noContent: ScriptedReply = { status: 204 };

const clientOn = (
  fake: FakeTransport,
  organizationId: string | null = ORG_ID,
) =>
  new TeachMeHipaa({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    ...(organizationId === null ? {} : { organizationId }),
    transport: fake.transport,
  });

describe("Generated methods on the wire", () => {
  it("sends a Custom method to its colon path with a generated Idempotency-Key", async () => {
    const route = `POST ${ORG}/enrollments/${ENROLLMENT_ID}:cancel`;
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(route, { json: enrollmentBody });

    const enrollment = await clientOn(fake).enrollments.cancel(ENROLLMENT_ID, {
      refund: false,
    });

    expect(enrollment).toEqual(enrollmentBody);
    const [request] = fake.requestsTo(route);
    expect(request?.headers["idempotency-key"]).toMatch(UUID_V4);
    expect(request?.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(textBody(request))).toEqual({ refund: false });
  });

  it("calls a partner method with the partnerId it is given and no Organization lookup", async () => {
    const route = `GET /v1/partners/${PARTNER_ID}/organizations`;
    const items = [
      {
        orgId: "org_clinic",
        name: "Clinic",
        createdAt: "2026-11-02T10:00:00.000Z",
        grantActive: true,
      },
    ];
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(route, {
        json: { items, nextCursor: "cur_2" },
        headers: { "x-request-id": "req_page" },
      });

    const page = await clientOn(fake, null).partners.organizations.list(
      PARTNER_ID,
      { limit: 10 },
    );

    expect(page.items).toEqual(items);
    expect(page.nextCursor).toBe("cur_2");
    expect(page.lastResponse.requestId).toBe("req_page");
    expect(fake.requests.map((request) => request.url)).toEqual([
      "https://api.tme.so/v1/auth/token",
      `https://api.tme.so/v1/partners/${PARTNER_ID}/organizations?limit=10`,
    ]);
  });

  it("sends a PATCH as a merge patch, keeping an explicit null", async () => {
    const route = `PATCH ${ORG}/webhook-subscriptions/${SUBSCRIPTION_ID}`;
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(route, { json: subscriptionBody });

    const subscription = await clientOn(fake).webhookSubscriptions.update(
      SUBSCRIPTION_ID,
      { enabled: false, description: null },
    );

    expect(subscription.enabled).toBe(false);
    const [request] = fake.requestsTo(route);
    expect(request?.headers["content-type"]).toBe(
      "application/merge-patch+json",
    );
    expect(request?.headers).not.toHaveProperty("idempotency-key");
    expect(textBody(request)).toBe('{"enabled":false,"description":null}');
  });

  it("resolves a 204 delete with its response metadata", async () => {
    const route = `DELETE ${ORG}/webhook-subscriptions/${SUBSCRIPTION_ID}`;
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(route, {
        ...noContent,
        headers: { "x-request-id": "req_deleted" },
      });

    const deleted =
      await clientOn(fake).webhookSubscriptions.delete(SUBSCRIPTION_ID);

    expect(deleted.lastResponse.status).toBe(204);
    expect(deleted.lastResponse.requestId).toBe("req_deleted");
    const [request] = fake.requestsTo(route);
    expect(request?.body).toBeUndefined();
    expect(request?.headers).not.toHaveProperty("content-type");
  });

  describe("Learner write results", () => {
    const route = `PUT ${ORG}/learners/by-external-id/hr%20123%2Fa`;

    it("marks a 201 as created, with the delivery details", async () => {
      const createdBody = {
        ...learnerBody,
        delivery: "none",
        joinUrl: "https://tme.so/j/abc",
      };
      const fake = createFakeTransport()
        .script(TOKEN_ROUTE, tokenReply())
        .script(route, { status: 201, json: createdBody });

      const result = await clientOn(fake).learners.upsertByExternalId(
        "hr 123/a",
        { email: "ana@example.com" },
      );

      expect(result).toEqual({ ...createdBody, created: true });
      expect(result.lastResponse.status).toBe(201);
      const [request] = fake.requestsTo(route);
      expect(request?.headers["idempotency-key"]).toMatch(UUID_V4);
      expect(JSON.parse(textBody(request))).toEqual({
        email: "ana@example.com",
      });
    });

    it("marks a 200 as not created", async () => {
      const fake = createFakeTransport()
        .script(TOKEN_ROUTE, tokenReply())
        .script(route, { status: 200, json: learnerBody });

      const result = await clientOn(fake).learners.upsertByExternalId(
        "hr 123/a",
        { email: "ana@example.com" },
      );

      expect(result).toEqual({ ...learnerBody, created: false });
      expect(result).not.toHaveProperty("joinUrl");
    });
  });

  it("keeps unknown fields and accepts unknown enum values", async () => {
    const future = {
      ...learnerBody,
      status: "on_leave",
      pronouns: "she/her",
    };
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, { json: future });

    const learner = await clientOn(fake).learners.retrieve(LEARNER_ID);

    expect(learner.status).toBe("on_leave");
    expect(learner).toHaveProperty("pronouns", "she/her");
    expect(JSON.parse(JSON.stringify(learner))).toEqual(future);
  });

  describe("Enrollment CSV import", () => {
    const route = `POST ${ORG}/enrollments:import`;
    const csv = new TextEncoder().encode("email\nana@example.com\n");

    const sentParts = async (fake: FakeTransport) => {
      const body = fake.requestsTo(route)[0]?.body;
      if (!(body instanceof FormData)) {
        throw new Error("Expected a multipart body");
      }
      const file = body.get("file");
      const options = body.get("options");
      if (!(file instanceof Blob) || !(options instanceof Blob)) {
        throw new Error("Expected file and options parts");
      }
      return {
        file: { type: file.type, text: await file.text() },
        options: {
          type: options.type,
          json: JSON.parse(await options.text()) as unknown,
        },
      };
    };

    it("previews with validateOnly set by the method", async () => {
      const preview = {
        totalRows: 1,
        validRows: 1,
        seatsRequired: 1,
        seatsAvailable: 4,
        rows: [
          {
            rowNumber: 2,
            email: "ana@example.com",
            courseId: "hipaa-2026",
            status: "valid",
          },
        ],
      };
      const fake = createFakeTransport()
        .script(TOKEN_ROUTE, tokenReply())
        .script(route, { json: preview });

      const result = await clientOn(fake).enrollments.previewImport({
        file: csv,
        options: { courseId: "hipaa-2026" },
      });

      expect(result).toEqual(preview);
      expect(await sentParts(fake)).toEqual({
        file: { type: "text/csv", text: "email\nana@example.com\n" },
        options: {
          type: "application/json",
          json: { courseId: "hipaa-2026", validateOnly: true },
        },
      });
      expect(fake.requestsTo(route)[0]?.headers["idempotency-key"]).toMatch(
        UUID_V4,
      );
    });

    it("commits with validateOnly false and returns the Operation", async () => {
      const operation = { name: "op_01JD8H", done: true };
      const fake = createFakeTransport()
        .script(TOKEN_ROUTE, tokenReply())
        .script(route, { json: operation });

      const result = await clientOn(fake).enrollments.import({ file: csv });

      expect(result).toEqual(operation);
      expect((await sentParts(fake)).options.json).toEqual({
        validateOnly: false,
      });
    });
  });

  describe("Certificate PDF download", () => {
    const route = `GET ${ORG}/certificates/${CERTIFICATE_ID}/content`;

    it("returns the PDF bytes unchanged with content type and filename", async () => {
      const pdf = new Uint8Array([
        0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff, 0x0a,
      ]);
      const fake = createFakeTransport()
        .script(TOKEN_ROUTE, tokenReply())
        .script(route, {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": 'attachment; filename="certificate-ana.pdf"',
          },
          bytes: pdf,
        });

      const file =
        await clientOn(fake).certificates.downloadPdf(CERTIFICATE_ID);

      expect(file.data).toEqual(pdf);
      expect(file.contentType).toBe("application/pdf");
      expect(file.filename).toBe("certificate-ana.pdf");
      expect(file.lastResponse.status).toBe(200);
    });

    it("raises an ApiError for a 200 HTML page instead of returning it as the PDF", async () => {
      const fake = createFakeTransport()
        .script(TOKEN_ROUTE, tokenReply())
        .script(route, {
          headers: { "content-type": "text/html" },
          body: "<!doctype html><title>Not found</title>",
        });

      await expect(
        clientOn(fake).certificates.downloadPdf(CERTIFICATE_ID),
      ).rejects.toBeInstanceOf(ApiError);
    });
  });
});
