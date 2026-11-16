import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import TeachMeHipaa, {
  TeachMeHipaaError,
  WebhookSignatureError,
  webhooks,
} from "../src/index.js";

// The shared cross-SDK vector (~/scratch/tmh-sdks/_shared/webhook-vector.json).
// Signed by the platform's own signer, not this SDK: `bun platform-sign.ts`
// run in the monorepo calls packages/auth-s2s `signRequest` on
// packages/webhooks `canonicalizeEventBody(envelope)`, and a node:crypto-only
// replica of auth-s2s canonical.ts produced the same hex.
const SECRET = "4l28+FYKZo2O57actVGINwR/Xyhzt3OtqCipV81/Zd0=";
const KEY_ID = "WHSEC-7KQ2-M4XD-9RTB-H3VN";
const PATH = "/hooks/tmh?source=teachmehipaa";
const EVENT_TIMESTAMP = "2026-11-15T16:31:32.123Z";
const EVENT_BODY =
  '{"data":{"courseId":"hipaa-basics-2026","email":"zoë.müller@example.com","externalId":"hr-123","learnerId":"lrn_4h7j2k","occurredAt":"2026-11-15T16:31:30.000Z","status":"certified"},"eventId":"evt_01JCZ8Y2K5V3M7Q9R4T6W8X0AB","eventType":"learner.certified","occurredAt":"2026-11-15T16:31:30.000Z","orgId":"org_9f3k2m"}';
const EVENT_BODY_HASH =
  "0a849105d2fea53433e3284d0dc6dee83ebccdf6e64088bf34bf3b537b6e640b";
const EVENT_SIGNATURE =
  "c2a0fd14bca6c361c44e84a5b3bf0378b00c49a533636a229c2b6972073b618a";

const eventHeaders = (): Record<string, string> => ({
  "x-tmh-key-id": KEY_ID,
  "x-tmh-timestamp": EVENT_TIMESTAMP,
  "x-tmh-signature": EVENT_SIGNATURE,
  "x-tmh-body-hash": EVENT_BODY_HASH,
  "x-tmh-event-type": "learner.certified",
  "x-tmh-event-id": "evt_01JCZ8Y2K5V3M7Q9R4T6W8X0AB",
  "content-type": "application/json",
});

const eventHeadersWithout = (name: string): Record<string, string> =>
  Object.fromEntries(
    Object.entries(eventHeaders()).filter(([key]) => key !== name),
  );

// What a signer that wrongly base64-decodes the Signing secret produces for
// the same Delivery (vector/replica.mjs, `Buffer.from(secret, "base64")`).
const SIGNATURE_WITH_DECODED_KEY =
  "26c88e3993dc44d1f52949f6bc1a9061c5e3e9c0b12caf04934e2e4ea3814f2d";

// The vector's Test delivery, signed the same way: the body the platform's
// `:test` route builds, canonicalized.
const TEST_DELIVERY_TIMESTAMP = "2026-11-15T16:40:05.000Z";
const TEST_DELIVERY_BODY = '{"subscriptionId":"whs_2b8f4c1d","test":true}';
const TEST_DELIVERY_SIGNATURE =
  "b7baa3ae58a738d025adf4e27ce7af833ac6085f5cb1cc5fc8ff1addb191c3b9";

const atEventTime = { receivedAt: new Date("2026-11-15T16:31:40.000Z") };

describe("webhooks.constructEvent", () => {
  it("verifies a Delivery signed by the platform and returns its Event", async () => {
    const event = await webhooks.constructEvent(
      EVENT_BODY,
      eventHeaders(),
      SECRET,
      PATH,
      atEventTime,
    );

    expect(event).toEqual({
      eventId: "evt_01JCZ8Y2K5V3M7Q9R4T6W8X0AB",
      eventType: "learner.certified",
      orgId: "org_9f3k2m",
      occurredAt: "2026-11-15T16:31:30.000Z",
      data: {
        learnerId: "lrn_4h7j2k",
        email: "zoë.müller@example.com",
        externalId: "hr-123",
        courseId: "hipaa-basics-2026",
        status: "certified",
        occurredAt: "2026-11-15T16:31:30.000Z",
      },
    });
  });

  const rejection = async (
    rawBody: string | Uint8Array,
    headers: Record<string, string>,
    secret: string,
    path: string,
    options: { tolerance?: number; receivedAt?: Date } = atEventTime,
  ): Promise<WebhookSignatureError> => {
    const error: unknown = await webhooks
      .constructEvent(rawBody, headers, secret, path, options)
      .then(
        () => expect.fail("expected the Delivery to be rejected"),
        (reason: unknown) => reason,
      );
    expect(error).toBeInstanceOf(WebhookSignatureError);
    expect(error).toBeInstanceOf(TeachMeHipaaError);
    return error as WebhookSignatureError;
  };

  it("rejects a tampered body", async () => {
    const tampered = EVENT_BODY.replace("hr-123", "hr-124");
    const error = await rejection(tampered, eventHeaders(), SECRET, PATH);
    expect(error.message).toMatch(/raw request body/);
  });

  it("rejects a tampered body when no x-tmh-body-hash header came with it", async () => {
    const headers = eventHeadersWithout("x-tmh-body-hash");
    const tampered = EVENT_BODY.replace("hr-123", "hr-124");
    const error = await rejection(tampered, headers, SECRET, PATH);
    expect(error.code).toBe("signature_mismatch");
  });

  it("rejects a Delivery verified against the wrong path", async () => {
    const error = await rejection(
      EVENT_BODY,
      eventHeaders(),
      SECRET,
      "/hooks/tmh",
    );
    expect(error.code).toBe("signature_mismatch");
    expect(error.message).toMatch(/exact request path/);
  });

  it("rejects a Delivery verified with the wrong Signing secret", async () => {
    const error = await rejection(
      EVENT_BODY,
      eventHeaders(),
      "Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0Z2FycGx5",
      PATH,
    );
    expect(error.code).toBe("signature_mismatch");
  });

  it("rejects a signature made with the base64-decoded Signing secret", async () => {
    const headers = {
      ...eventHeaders(),
      "x-tmh-signature": SIGNATURE_WITH_DECODED_KEY,
    };
    const error = await rejection(EVENT_BODY, headers, SECRET, PATH);
    expect(error.code).toBe("signature_mismatch");
  });

  it.each(["x-tmh-signature", "x-tmh-timestamp"])(
    "rejects a Delivery without a %s header",
    async (name) => {
      const error = await rejection(
        EVENT_BODY,
        eventHeadersWithout(name),
        SECRET,
        PATH,
      );
      expect(error.code).toBe("missing_header");
      expect(error.message).toContain(name);
    },
  );

  it("rejects a Delivery whose timestamp is more than 5 minutes old", async () => {
    const error = await rejection(EVENT_BODY, eventHeaders(), SECRET, PATH, {
      receivedAt: new Date("2026-11-15T16:36:32.124Z"),
    });
    expect(error.code).toBe("timestamp_outside_tolerance");
  });

  it("rejects a Delivery whose timestamp is more than 5 minutes in the future", async () => {
    const error = await rejection(EVENT_BODY, eventHeaders(), SECRET, PATH, {
      receivedAt: new Date("2026-11-15T16:26:32.122Z"),
    });
    expect(error.code).toBe("timestamp_outside_tolerance");
  });

  it("accepts a Delivery exactly 5 minutes old", async () => {
    const event = await webhooks.constructEvent(
      EVENT_BODY,
      eventHeaders(),
      SECRET,
      PATH,
      { receivedAt: new Date("2026-11-15T16:36:32.123Z") },
    );
    expect(event).toMatchObject({ eventType: "learner.certified" });
  });

  it("honors a custom tolerance in seconds", async () => {
    const error = await rejection(EVENT_BODY, eventHeaders(), SECRET, PATH, {
      tolerance: 5,
      receivedAt: new Date("2026-11-15T16:31:40.000Z"),
    });
    expect(error.code).toBe("timestamp_outside_tolerance");
  });

  it("checks the signature before the timestamp, so a forgery never looks merely late", async () => {
    const tampered = EVENT_BODY.replace("hr-123", "hr-124");
    const headers = eventHeadersWithout("x-tmh-body-hash");
    const error = await rejection(tampered, headers, SECRET, PATH, {
      receivedAt: new Date("2027-01-01T00:00:00.000Z"),
    });
    expect(error.code).toBe("signature_mismatch");
  });

  it("rejects a timestamp that is not ISO 8601", async () => {
    const headers = {
      ...eventHeaders(),
      "x-tmh-timestamp": "1763224292",
    };
    const error = await rejection(EVENT_BODY, headers, SECRET, PATH);
    expect(error.code).toBe("invalid_timestamp");
  });

  it("refuses an empty Signing secret as a programming error", async () => {
    await expect(
      webhooks.constructEvent(EVENT_BODY, eventHeaders(), "", PATH),
    ).rejects.toThrow(/Signing secret/);
  });

  it.each([0, -1, Number.NaN])(
    "refuses a tolerance of %s as a programming error",
    async (tolerance) => {
      await expect(
        webhooks.constructEvent(EVENT_BODY, eventHeaders(), SECRET, PATH, {
          tolerance,
        }),
      ).rejects.toThrow(RangeError);
    },
  );

  it("returns a Test delivery as its own type", async () => {
    const delivery = await webhooks.constructEvent(
      TEST_DELIVERY_BODY,
      {
        "x-tmh-key-id": KEY_ID,
        "x-tmh-timestamp": TEST_DELIVERY_TIMESTAMP,
        "x-tmh-signature": TEST_DELIVERY_SIGNATURE,
        "x-tmh-event-type": "learner.certified",
        "x-tmh-event-id": "3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d",
      },
      SECRET,
      PATH,
      { receivedAt: new Date("2026-11-15T16:40:06.000Z") },
    );

    expect(delivery).toEqual({ subscriptionId: "whs_2b8f4c1d", test: true });
    if (!("test" in delivery)) expect.fail("expected a Test delivery");
    expect(delivery.subscriptionId).toBe("whs_2b8f4c1d");
  });

  it("returns an Event of a type not in the catalog as a generic Event", async () => {
    const body = JSON.stringify({
      data: { learnerId: "lrn_4h7j2k", badge: "gold" },
      eventId: "evt_01JCZ9000000000000000000AB",
      eventType: "learner.promoted",
      occurredAt: "2026-11-15T16:31:30.000Z",
      orgId: "org_9f3k2m",
    });
    const headers = await webhooks.generateTestHeaders({
      payload: body,
      secret: SECRET,
      path: PATH,
      timestamp: new Date(EVENT_TIMESTAMP),
    });

    const event = await webhooks.constructEvent(
      body,
      headers,
      SECRET,
      PATH,
      atEventTime,
    );

    expect(event).toMatchObject({
      eventType: "learner.promoted",
      data: { badge: "gold" },
    });
  });

  it("accepts a Fetch Headers object, the raw body as bytes, and any header case", async () => {
    const headers = new Headers({
      "X-TMH-Timestamp": EVENT_TIMESTAMP,
      "X-TMH-Signature": EVENT_SIGNATURE,
    });
    const event = await webhooks.constructEvent(
      new TextEncoder().encode(EVENT_BODY),
      headers,
      SECRET,
      PATH,
      atEventTime,
    );
    expect(event).toMatchObject({ eventId: "evt_01JCZ8Y2K5V3M7Q9R4T6W8X0AB" });
  });

  it("accepts Node-style headers with mixed case and repeated values", async () => {
    const event = await webhooks.constructEvent(
      EVENT_BODY,
      {
        "X-Tmh-Timestamp": [EVENT_TIMESTAMP],
        "x-tmh-signature": EVENT_SIGNATURE,
        "x-tmh-key-id": undefined,
      },
      SECRET,
      PATH,
      atEventTime,
    );
    expect(event).toMatchObject({ eventType: "learner.certified" });
  });

  it("accepts the full request URL in place of the path", async () => {
    const event = await webhooks.constructEvent(
      EVENT_BODY,
      eventHeaders(),
      SECRET,
      "https://partner.example.com/hooks/tmh?source=teachmehipaa",
      atEventTime,
    );
    expect(event).toMatchObject({ eventType: "learner.certified" });
  });

  it("is also reachable from a client and statically, without credentials", () => {
    const client = new TeachMeHipaa({
      clientId: "cli_unused",
      clientSecret: "tmh_cs_unused",
    });
    expect(client.webhooks).toBe(webhooks);
    expect(TeachMeHipaa.webhooks).toBe(webhooks);
  });
});

describe("webhooks.generateTestHeaders", () => {
  it("produces the headers the platform sends for the same Delivery", async () => {
    const headers = await webhooks.generateTestHeaders({
      payload: EVENT_BODY,
      secret: SECRET,
      path: PATH,
      timestamp: new Date(EVENT_TIMESTAMP),
      eventType: "learner.certified",
      eventId: "evt_01JCZ8Y2K5V3M7Q9R4T6W8X0AB",
      keyId: KEY_ID,
    });

    expect(headers).toEqual(eventHeaders());
  });

  it("produces headers that constructEvent accepts now", async () => {
    const headers = await webhooks.generateTestHeaders({
      payload: TEST_DELIVERY_BODY,
      secret: SECRET,
      path: PATH,
    });

    await expect(
      webhooks.constructEvent(TEST_DELIVERY_BODY, headers, SECRET, PATH),
    ).resolves.toEqual({ subscriptionId: "whs_2b8f4c1d", test: true });
  });

  it("leaves out the identifying headers it was not given", async () => {
    const headers = await webhooks.generateTestHeaders({
      payload: TEST_DELIVERY_BODY,
      secret: SECRET,
      path: PATH,
      timestamp: new Date(TEST_DELIVERY_TIMESTAMP),
    });

    expect(headers).toEqual({
      "x-tmh-timestamp": TEST_DELIVERY_TIMESTAMP,
      "x-tmh-signature": TEST_DELIVERY_SIGNATURE,
      "x-tmh-body-hash":
        "42879a05e13a5dfba51eee07c2fef4814ec6009091f1389a8db4403661ce6a66",
      "content-type": "application/json",
    });
  });
});

describe("the vendored IR's signing recipe", () => {
  // The verifier hardcodes ADR-0005's recipe. If the IR ever describes a
  // different one, this fails and the verifier must change with it.
  it("is the recipe this SDK verifies", () => {
    const ir = JSON.parse(
      readFileSync(new URL("../openapi/sdk-ir.json", import.meta.url), "utf8"),
    ) as { events: { signing: unknown } };

    expect(ir.events.signing).toEqual({
      algorithm: "hmacSha256Hex",
      canonical: {
        parts: [
          { kind: "literal", value: "POST" },
          { kind: "pathAndQuery" },
          { kind: "header", name: "x-tmh-timestamp" },
          { kind: "bodySha256Hex" },
        ],
        separator: "\n",
      },
      headers: {
        bodyHash: "x-tmh-body-hash",
        eventId: "x-tmh-event-id",
        eventType: "x-tmh-event-type",
        keyId: "x-tmh-key-id",
        signature: "x-tmh-signature",
        timestamp: "x-tmh-timestamp",
      },
      key: "secretUtf8",
      timestampFormat: "iso8601",
      toleranceSeconds: 300,
    });
  });
});
