import { beforeEach, describe, expect, inject, it } from "vitest";
import TeachMeHipaa, {
  InvalidRequestError,
  staticTokenProvider,
} from "../../src/index.js";

// Values that satisfy the spec's path-parameter patterns.
const ORG_ID = "org_acme";
const LEARNER_ID = "sub_01JD80AB2C3D4E5F6G7H8J9K0M";
const ENROLLMENT_ID = "sub_01JD80AB2C3D4E5F6G7H8J9K0M__hipaa-2026";
const CERTIFICATE_ID = "cert_01JD8F";
const COURSE_ID = "hipaa-2026";
const SUBSCRIPTION_ID = "whs_01JD8D";
const OPERATION_ID = "op-01JD8H";
const TINY_ID = "cAbCdEfGhIjKl";

interface Violation {
  readonly location: readonly string[];
  readonly message: string;
}

/**
 * Prism names every rule a request broke in `sl-violations`. Violations in
 * its own generated responses are left out: they come from Prism's example
 * generator, not from anything the SDK sent (see `prism.ts`).
 */
const requestViolations: string[] = [];
const recordingFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  const url = input instanceof Request ? input.url : input.toString();
  const header = response.headers.get("sl-violations");
  const found = header === null ? [] : (JSON.parse(header) as Violation[]);
  found
    .filter((violation) => violation.location[0] === "request")
    .forEach((violation) => {
      requestViolations.push(
        `${init?.method ?? "GET"} ${url}: ${violation.location.join(".")} ${violation.message}`,
      );
    });
  return response;
};

// Prism can't mint tokens from the form-encoded `/auth/token`, so the client
// sends a static one and skips Organization discovery.
const client = new TeachMeHipaa({
  tokenProvider: staticTokenProvider("contract-test-token"),
  organizationId: ORG_ID,
  baseUrl: inject("prismUrl"),
  maxRetries: 0,
  fetch: recordingFetch,
});

beforeEach(() => {
  requestViolations.length = 0;
  return () => {
    expect(requestViolations).toEqual([]);
  };
});

describe("Contract: the harness", () => {
  it("catches a request that breaks the spec", async () => {
    const page = client.courses.list({ limit: 0 });

    await expect(page).rejects.toBeInstanceOf(InvalidRequestError);
    expect(requestViolations.join()).toContain("limit");
    requestViolations.length = 0;
  });
});

describe("Contract: Courses (public)", () => {
  it("lists Courses as a page", async () => {
    const page = await client.courses.list({ limit: 5 });

    expect(Array.isArray(page.items)).toBe(true);
    page.items.forEach((course) => {
      expect(typeof course.courseId).toBe("string");
      expect(typeof course.passingThreshold).toBe("number");
    });
    expect(page.lastResponse.status).toBe(200);
  });

  it("retrieves a Course", async () => {
    const course = await client.courses.retrieve(COURSE_ID);

    expect(typeof course.title).toBe("string");
  });

  it("retrieves a Certificate verification", async () => {
    const verification =
      await client.certificateVerifications.retrieve(TINY_ID);

    expect(typeof verification.learnerName).toBe("string");
    expect(typeof verification.issuer).toBe("string");
  });
});

describe("Contract: Learners", () => {
  it("creates a Learner and reports whether it was created", async () => {
    const learner = await client.learners.create({
      email: "ana@example.com",
      name: "Ana Example",
      externalId: "hr-123",
      courseId: COURSE_ID,
      delivery: "none",
    });

    expect(typeof learner.learnerId).toBe("string");
    expect(typeof learner.created).toBe("boolean");
    expect(learner.lastResponse.headers).toBeDefined();
  });

  it("lists Learners with filters", async () => {
    const page = await client.learners.list({
      limit: 10,
      status: "in_progress",
      email: "ana@example.com",
    });

    expect(Array.isArray(page.items)).toBe(true);
    page.items.forEach((learner) => {
      expect(typeof learner.email).toBe("string");
    });
  });

  it("retrieves a Learner", async () => {
    const learner = await client.learners.retrieve(LEARNER_ID, {
      courseId: COURSE_ID,
    });

    expect(typeof learner.learnerId).toBe("string");
    expect(typeof learner.course).toBe("object");
  });

  it("updates a Learner as merge-patch with If-Match", async () => {
    const learner = await client.learners.update(
      LEARNER_ID,
      { name: "Ana Q. Example", externalId: null },
      { ifMatch: '"7"' },
    );

    expect(typeof learner.learnerId).toBe("string");
  });
});

describe("Contract: Enrollments", () => {
  it("cancels an Enrollment with an Idempotency-Key", async () => {
    const result = await client.enrollments.cancel(ENROLLMENT_ID, {
      refund: false,
    });

    expect(result.lastResponse.status).toBe(200);
  });
});

describe("Contract: Certificates", () => {
  it("retrieves a Certificate", async () => {
    const certificate = await client.certificates.retrieve(CERTIFICATE_ID);

    expect(typeof certificate.certificateId).toBe("string");
  });

  it("downloads a Certificate PDF", async () => {
    const pdf = await client.certificates.downloadPdf(CERTIFICATE_ID);

    expect(pdf.data).toBeInstanceOf(Uint8Array);
    expect(pdf.contentType).toMatch(/^application\/pdf/);
  });
});

describe("Contract: Webhook subscriptions", () => {
  it("creates a Webhook subscription and returns its Signing secret", async () => {
    const subscription = await client.webhookSubscriptions.create({
      endpointUrl: "https://hr.example.com/hooks/tmh",
      eventTypes: ["learner.certified", "seats.low"],
      description: "HR sync",
      seatsLowThreshold: 5,
    });

    expect(typeof subscription.subscriptionId).toBe("string");
    expect(typeof subscription.secret).toBe("string");
  });

  it("deletes a Webhook subscription", async () => {
    const deleted = await client.webhookSubscriptions.delete(SUBSCRIPTION_ID);

    expect(deleted.lastResponse.status).toBe(204);
  });
});

describe("Contract: Events, Operations and auth", () => {
  it("lists the Event log", async () => {
    const page = await client.events.list({ limit: 25 });

    expect(Array.isArray(page.items)).toBe(true);
    page.items.forEach((event) => {
      expect(typeof event.eventType).toBe("string");
    });
  });

  it("retrieves an Operation", async () => {
    const operation = await client.operations.retrieve(OPERATION_ID);

    expect(typeof operation.name).toBe("string");
    expect(typeof operation.wait).toBe("function");
  });

  it("introspects the Access token", async () => {
    const introspection = await client.auth.introspect();

    expect(typeof introspection.actorType).toBe("string");
  });
});
