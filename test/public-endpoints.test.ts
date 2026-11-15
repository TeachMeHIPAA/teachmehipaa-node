import { describe, expect, it } from "vitest";
import TeachMeHipaa, { type TokenProvider } from "../src/index.js";
import { createFakeTransport } from "./support/fake-transport.js";
import { CLIENT_ID, CLIENT_SECRET } from "./support/fixtures.js";

const COURSE_ID = "hipaa-2026";
const TINY_ID = "aB3dE9";

/** `dev#/components/schemas/CourseDto`. */
const courseBody = {
  courseId: COURSE_ID,
  title: "HIPAA Training 2026",
  courseVersion: "2026.1",
  passingThreshold: 80,
};

/** `dev#/components/schemas/CertificateVerificationDto`. */
const verificationBody = {
  status: "valid",
  learnerName: "Ana Example",
  courseTitle: "HIPAA Training 2026",
  issuedAt: "2026-11-02T10:30:00.000Z",
  expiresAt: "2027-11-02T10:30:00.000Z",
  issuer: { name: "TeachMeHIPAA", url: "https://teachmehipaa.com" },
};

/** Fails the test if the client ever asks it for a token. */
const refusingTokenProvider = (): TokenProvider => ({
  getAccessToken: () =>
    Promise.reject(new Error("a public endpoint asked for an Access token")),
  invalidate: () => undefined,
});

describe("Public endpoints (security: none)", () => {
  it("lists Courses without minting an Access token or binding the Organization", async () => {
    const fake = createFakeTransport().script("GET /v1/courses", {
      json: { items: [courseBody], nextCursor: null },
    });
    const client = new TeachMeHipaa({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      transport: fake.transport,
    });

    const page = await client.courses.list();

    expect(page.items).toEqual([courseBody]);
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0]?.headers).not.toHaveProperty("authorization");
  });

  it("retrieves a Course and a Certificate verification without asking the token provider", async () => {
    const fake = createFakeTransport()
      .script(`GET /v1/courses/${COURSE_ID}`, { json: courseBody })
      .script(`GET /v1/certificate-verifications/${TINY_ID}`, {
        json: verificationBody,
      });
    const client = new TeachMeHipaa({
      tokenProvider: refusingTokenProvider(),
      transport: fake.transport,
    });

    const course = await client.courses.retrieve(COURSE_ID);
    const verification =
      await client.certificateVerifications.retrieve(TINY_ID);

    expect(course.title).toBe("HIPAA Training 2026");
    expect(verification.status).toBe("valid");
    fake.requests.forEach((request) => {
      expect(request.headers).not.toHaveProperty("authorization");
    });
  });

  it("still authenticates every other call", async () => {
    const fake = createFakeTransport().script("GET /v1/auth/introspection", {
      json: { actorType: "client", orgId: "org_acme" },
    });
    const client = new TeachMeHipaa({
      tokenProvider: {
        getAccessToken: () => Promise.resolve("jwt-static"),
        invalidate: () => undefined,
      },
      transport: fake.transport,
    });

    await client.auth.introspect();

    expect(fake.requests[0]?.headers.authorization).toBe("Bearer jwt-static");
  });
});
