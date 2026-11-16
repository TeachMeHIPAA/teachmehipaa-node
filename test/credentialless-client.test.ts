import { describe, expect, it } from "vitest";
import TeachMeHipaa, { type TeachMeHipaaOptions } from "../src/index.js";
import { createFakeTransport } from "./support/fake-transport.js";
import { CLIENT_ID, CLIENT_SECRET } from "./support/fixtures.js";

const TINY_ID = "aB3dE9";

/** `dev#/components/schemas/CourseDto`. */
const courseBody = {
  courseId: "hipaa-2026",
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
  issuer: "TeachMeHIPAA",
};

describe("A client without credentials", () => {
  it("lists Courses and looks up a Certificate verification with no token request", async () => {
    const fake = createFakeTransport()
      .script("GET /v1/courses", {
        json: { items: [courseBody], nextCursor: null },
      })
      .script(`GET /v1/certificate-verifications/${TINY_ID}`, {
        json: verificationBody,
      });
    const client = new TeachMeHipaa({
      environment: "sandbox",
      transport: fake.transport,
    });

    const page = await client.courses.list();
    const verification =
      await client.certificateVerifications.retrieve(TINY_ID);

    expect(page.items).toEqual([courseBody]);
    expect(verification.status).toBe("valid");
    expect(fake.requests.map((request) => request.url)).toEqual([
      "https://api-teachmehipaa-dev.web.app/v1/courses",
      `https://api-teachmehipaa-dev.web.app/v1/certificate-verifications/${TINY_ID}`,
    ]);
    fake.requests.forEach((request) => {
      expect(request.headers).not.toHaveProperty("authorization");
    });
  });

  it("fails an Organization-scoped call before any request, without looking up the Organization", async () => {
    const fake = createFakeTransport();
    const client = new TeachMeHipaa({
      environment: "sandbox",
      transport: fake.transport,
    });

    const call = client.learners.list();

    await expect(call).rejects.toBeInstanceOf(TypeError);
    await expect(call).rejects.toThrow(
      /^teachmehipaa: GET \/learners needs credentials, and this client has none; pass clientId and clientSecret, or a tokenProvider/,
    );
    expect(fake.requests).toEqual([]);
  });

  it("fails a call that isn't Organization-scoped before any request", async () => {
    const fake = createFakeTransport();
    const client = new TeachMeHipaa({ transport: fake.transport });

    await expect(client.auth.introspect()).rejects.toThrow(
      /^teachmehipaa: GET \/auth\/introspection needs credentials/,
    );
    expect(fake.requests).toEqual([]);
  });

  it.each([
    ["only a clientId", { clientId: CLIENT_ID }, /clientSecret/],
    ["only a clientSecret", { clientSecret: CLIENT_SECRET }, /clientId/],
    ["only scopes", { scopes: ["learners:read"] }, /clientId/],
  ])("still refuses %s at construction", (_, options, message) => {
    expect(
      () => new TeachMeHipaa(options as unknown as TeachMeHipaaOptions),
    ).toThrow(message);
  });

  it("accepts no credentials in the options type, but not half a pair", () => {
    // Type-checked by `npm run typecheck`, never called.
    const construct = () => [
      new TeachMeHipaa({}),
      new TeachMeHipaa({ environment: "sandbox", maxRetries: 0 }),
      // @ts-expect-error clientId needs clientSecret
      new TeachMeHipaa({ clientId: CLIENT_ID }),
      // @ts-expect-error clientSecret needs clientId
      new TeachMeHipaa({ clientSecret: CLIENT_SECRET }),
      // @ts-expect-error scopes need clientId and clientSecret
      new TeachMeHipaa({ scopes: ["learners:read"] }),
      // @ts-expect-error an explicit undefined clientId is still half a pair
      new TeachMeHipaa({ clientId: undefined, clientSecret: CLIENT_SECRET }),
    ];

    expect(construct).toBeTypeOf("function");
  });
});
