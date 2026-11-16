import { readdirSync } from "node:fs";
import { describe, expect, vi } from "vitest";
import {
  createFakeTransport,
  textBody,
  type ScriptedReply,
} from "./support/fake-transport.js";
import {
  INTROSPECTION_ROUTE,
  LEARNER_ID,
  LEARNER_ROUTE,
  ORG,
  ORG_ID,
  TOKEN_ROUTE,
  introspectionReply,
  learnerBody,
  learnerReply,
  tokenReply,
} from "./support/fixtures.js";
import {
  ROOT,
  WEBHOOK_SECRET,
  event,
  exportOperation,
  learner,
  logged,
  page,
  sampleSuite,
  webhooks,
} from "./readme/harness.js";

const GUIDES = readdirSync(`${ROOT}docs/guides`)
  .filter((name) => name.endsWith(".md"))
  .map((name) => `docs/guides/${name}`);

const { runs, runSample, checksEverySample } = sampleSuite("guides", GUIDES);

/** Samples that can't run against a fake transport, and why. */
const TYPE_CHECKED_ONLY: Readonly<Record<string, string>> = {
  "webhook-express": "starts an Express server",
  "webhook-node-http": "starts an HTTP server",
  "pdf-download": "writes files to disk",
};

const OPERATION_ID = "0b7d4a8e-5c1f-4e2a-9d3b-6f8a1c2e4b7d";
const OPERATION_ROUTE = `GET ${ORG}/operations/${OPERATION_ID}`;

/** `dev#/components/schemas/Operation`, still running. */
const runningOperation = (kind: string): ScriptedReply => ({
  status: 202,
  json: {
    name: `organizations/${ORG_ID}/operations/${OPERATION_ID}`,
    done: false,
    metadata: { kind },
  },
});

/** `dev#/components/schemas/Operation`, done with `response`. */
const doneOperation = (kind: string, response: unknown): ScriptedReply => ({
  json: {
    name: `organizations/${ORG_ID}/operations/${OPERATION_ID}`,
    done: true,
    metadata: { kind },
    response,
  },
});

const problem = (status: number, code: string): ScriptedReply => ({
  status,
  headers: { "content-type": "application/problem+json" },
  body: JSON.stringify({ title: code, status, code }),
});

/** `dev#/components/schemas/WebhookSubscription`. */
const subscriptionBody = {
  subscriptionId: "whs_01JD8Q",
  endpointUrl: "https://hr.example.com/webhooks/tmh",
  eventTypes: ["learner.certified"],
  enabled: true,
  description: "HR sync",
  seatsLowThreshold: 5,
  secretKeyId: "whk_01",
  createdAt: "2026-11-15T12:00:00.000Z",
  rev: 3,
};

const searchParams = (url: string | undefined) =>
  Object.fromEntries(new URL(url ?? "").searchParams);

describe("Guides", () => {
  checksEverySample(TYPE_CHECKED_ONLY);
});

describe("writes.md: create or upsert", () => {
  runs("writes-create", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(`POST ${ORG}/learners`, { status: 201, json: learnerBody });

    await runSample("writes-create", fake);

    expect(logged).toEqual([[LEARNER_ID, "invited"]]);
  });

  runs("writes-upsert", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(`PUT ${ORG}/learners/by-external-id/hr-123`, {
        status: 200,
        json: learnerBody,
      });

    await runSample("writes-upsert", fake);

    const [upsert] = fake.requestsTo(
      `PUT ${ORG}/learners/by-external-id/hr-123`,
    );
    expect(JSON.parse(textBody(upsert))).toEqual({
      email: "ana@example.com",
      name: "Ana Example",
    });
    expect(logged).toEqual([[LEARNER_ID, false]]);
  });

  runs("writes-seat-policy", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(`POST ${ORG}/learners`, problem(409, "seat_unavailable"));

    await runSample("writes-seat-policy", fake);

    const [create] = fake.requestsTo(`POST ${ORG}/learners`);
    expect(JSON.parse(textBody(create))).toEqual({
      email: "ana@example.com",
      seatPolicy: "require_available",
    });
    expect(logged).toEqual([["No Seat is free for this Learner"]]);
  });
});

describe("client.md: credentials", () => {
  runs("auth-client-credentials", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(INTROSPECTION_ROUTE, introspectionReply());

    await runSample("auth-client-credentials", fake);

    expect(logged).toEqual([[ORG_ID, ["learners:read", "learners:write"]]]);
  });

  runs("auth-scopes", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(`GET ${ORG}/learners`, page([learnerBody]));

    await runSample("auth-scopes", fake);

    const [token] = fake.requestsTo(TOKEN_ROUTE);
    expect(new URLSearchParams(textBody(token)).get("scope")).toBe(
      "learners:read compliance:read",
    );
    expect(logged).toEqual([[1]]);
  });

  runs("organization", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(`GET ${ORG}/compliance`, {
        json: { orgId: ORG_ID },
        headers: { "x-request-id": "req_compliance" },
      });

    await runSample("organization", fake);

    expect(fake.requestsTo(INTROSPECTION_ROUTE)).toEqual([]);
    expect(logged).toEqual([["req_compliance"]]);
  });

  runs("auth-static-token", async () => {
    vi.stubEnv("TMH_ACCESS_TOKEN", "minted-elsewhere");
    const fake = createFakeTransport().script(
      `GET ${ORG}/members/${LEARNER_ID}`,
      { json: { subjectId: LEARNER_ID } },
    );

    await runSample("auth-static-token", fake);

    expect(fake.requests[0]?.headers.authorization).toBe(
      "Bearer minted-elsewhere",
    );
    expect(logged).toEqual([[200]]);
  });

  runs("public-lookups", async () => {
    const fake = createFakeTransport()
      .script("GET /v1/certificate-verifications/aB3dE9", {
        json: {
          status: "valid",
          learnerName: "Ana Example",
          courseTitle: "HIPAA Training 2026",
          issuedAt: "2026-11-02T10:30:00.000Z",
          expiresAt: "2027-11-02T10:30:00.000Z",
          issuer: "TeachMeHIPAA",
        },
      })
      .script("GET /v1/courses", page([{ title: "HIPAA Training 2026" }]));

    await runSample("public-lookups", fake);

    expect(logged).toEqual([
      ["valid", "Ana Example"],
      [["HIPAA Training 2026"]],
    ]);
    expect(fake.requestsTo(TOKEN_ROUTE)).toEqual([]);
    fake.requests.forEach((request) => {
      expect(request.headers).not.toHaveProperty("authorization");
    });
  });
});

describe("errors.md and writes.md: errors, request options", () => {
  runs("errors", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, {
        status: 404,
        headers: { "content-type": "application/problem+json" },
        body: JSON.stringify({
          title: "Not found",
          status: 404,
          code: "not_found",
          detail: "No learner with that id.",
        }),
      });

    await runSample("errors", fake);

    expect(logged).toEqual([["No such Learner"]]);
  });

  runs("errors-code", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        `PATCH ${ORG}/learners/${LEARNER_ID}`,
        problem(409, "external_id_conflict"),
      );

    await runSample("errors-code", fake);

    const [update] = fake.requestsTo(`PATCH ${ORG}/learners/${LEARNER_ID}`);
    expect(update?.headers["if-match"]).toBe("*");
    expect(logged).toEqual([["Another Learner already has that External ID"]]);
  });

  runs("request-options", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(`POST ${ORG}/enrollments`, {
        status: 201,
        json: { enrollmentId: "enr_1" },
        headers: { "x-request-id": "hr-sync-42" },
      });

    await runSample("request-options", fake);

    const [create] = fake.requestsTo(`POST ${ORG}/enrollments`);
    expect(create?.headers["idempotency-key"]).toBe("hr-sync-2026-11-15-ana");
    expect(create?.headers["x-request-id"]).toBe("hr-sync-42");
    expect(create?.timeout).toBe(10_000);
    expect(logged).toEqual([["hr-sync-42"]]);
  });
});

describe("pagination.md", () => {
  runs("pagination", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        `GET ${ORG}/learners`,
        page([learner(1), learner(2)], "cursor-2"),
        page([learner(3)]),
        page([learner(4)]),
      )
      .script(
        `GET ${ORG}/enrollments`,
        page([{ enrollmentId: "enr_1" }], "cursor-e2"),
        page([{ enrollmentId: "enr_2" }, { enrollmentId: "enr_3" }]),
      );

    await runSample("pagination", fake);

    expect(logged).toEqual([
      [learner(1).learnerId],
      [learner(2).learnerId],
      [learner(3).learnerId],
      [2, 1],
    ]);
    expect(fake.requestsTo(`GET ${ORG}/learners`)[1]?.url).toContain(
      "cursor=cursor-2",
    );
  });

  runs("pagination-pages", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        `GET ${ORG}/certificates`,
        {
          ...page([{ certificateId: "c1" }, { certificateId: "c2" }], "next"),
          headers: { "x-request-id": "req_1" },
        },
        {
          ...page([{ certificateId: "c3" }]),
          headers: { "x-request-id": "req_2" },
        },
      );

    await runSample("pagination-pages", fake);

    expect(logged).toEqual([
      [2, "req_1"],
      [1, "req_2"],
    ]);
    const second = fake.requestsTo(`GET ${ORG}/certificates`)[1];
    expect(searchParams(second?.url)).toEqual({ limit: "100", cursor: "next" });
  });

  runs("events-list", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        `GET ${ORG}/events`,
        page([
          event("evt_02"),
          {
            ...event("evt_03"),
            eventType: "seats.low",
            data: { available: 3, threshold: 5 },
          },
          { ...event("evt_04"), eventType: "invite.bounced" },
        ]),
      );

    await runSample("events-list", fake);

    expect(searchParams(fake.requestsTo(`GET ${ORG}/events`)[0]?.url)).toEqual({
      after: "evt_01",
    });
    expect(logged).toEqual([
      ["certified", "ana@example.com"],
      ["Seats left:", 3],
      ["other", "invite.bounced"],
    ]);
  });

  runs("events-tail", async () => {
    const savedPositions: (string | null)[] = [];
    vi.stubGlobal("cursors", {
      load: () => Promise.resolve("evt_01"),
      save: (eventId: string | null) => {
        savedPositions.push(eventId);
        return Promise.resolve();
      },
    });
    const controllers: AbortController[] = [];
    const RealAbortController = AbortController;
    // The sample's controller is how a real service stops the tail; the
    // test aborts it once the log has nothing new.
    vi.stubGlobal(
      "AbortController",
      class extends RealAbortController {
        constructor() {
          super();
          controllers.push(this);
        }
      },
    );
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        `GET ${ORG}/events`,
        page([event("evt_02"), event("evt_03")]),
        () => {
          controllers.forEach((controller) => {
            controller.abort();
          });
          return page([]);
        },
      );

    await runSample("events-tail", fake);

    const polls = fake.requestsTo(`GET ${ORG}/events`);
    expect(polls[0]?.url).toContain("after=evt_01");
    expect(polls[1]?.url).toContain("after=evt_03");
    expect(savedPositions).toEqual(["evt_02", "evt_03"]);
    expect(logged).toEqual([
      ["learner.certified", "evt_02"],
      ["learner.certified", "evt_03"],
    ]);
  });
});

describe("webhooks.md", () => {
  runs("webhook-subscription-create", async () => {
    const stored: [string, string][] = [];
    vi.stubGlobal("secrets", {
      put: (name: string, value: string) => {
        stored.push([name, value]);
        return Promise.resolve();
      },
    });
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(`POST ${ORG}/webhook-subscriptions`, {
        status: 201,
        json: { ...subscriptionBody, secret: "whsec_shown_once" },
      });

    await runSample("webhook-subscription-create", fake);

    const [create] = fake.requestsTo(`POST ${ORG}/webhook-subscriptions`);
    expect(JSON.parse(textBody(create))).toEqual({
      endpointUrl: "https://hr.example.com/webhooks/tmh",
      eventTypes: ["learner.certified", "learner.expiring", "invite.bounced"],
      description: "HR sync",
    });
    expect(logged).toEqual([["whs_01JD8Q", "whk_01"]]);
    expect(stored).toEqual([["tmh-webhook-secret", "whsec_shown_once"]]);
  });

  runs("webhook-fetch", async () => {
    const handler = (await runSample("webhook-fetch", createFakeTransport()))
      .default as { fetch(request: Request): Promise<Response> };
    const payload = JSON.stringify(event("evt_01JD8M"));
    const url = "https://partner.example.com/webhooks/tmh?tenant=acme";
    const headers = await webhooks.generateTestHeaders({
      payload,
      secret: WEBHOOK_SECRET,
      path: "/webhooks/tmh?tenant=acme",
    });

    const accepted = await handler.fetch(
      new Request(url, { method: "POST", headers, body: payload }),
    );
    const tampered = await handler.fetch(
      new Request(url, {
        method: "POST",
        headers,
        body: payload.replace("learner.certified", "learner.removed"),
      }),
    );

    expect(accepted.status).toBe(200);
    expect(await accepted.text()).toBe("received learner.certified");
    expect(tampered.status).toBe(400);
    expect(await tampered.text()).toBe("body_hash_mismatch");
  });

  runs("webhook-dedupe", async () => {
    const handled = new Set<string>();
    vi.stubGlobal("processedEvents", {
      has: (eventId: string) => Promise.resolve(handled.has(eventId)),
      add: (eventId: string) => {
        handled.add(eventId);
        return Promise.resolve();
      },
    });
    const { handleDelivery } = (await runSample(
      "webhook-dedupe",
      createFakeTransport(),
    )) as {
      handleDelivery: (
        body: string,
        headers: Headers,
        url: string,
      ) => Promise<void>;
    };
    const payload = JSON.stringify(event("evt_01JD8M"));
    const headers = new Headers(
      await webhooks.generateTestHeaders({
        payload,
        secret: WEBHOOK_SECRET,
        path: "/webhooks/tmh",
      }),
    );
    const url = "https://hr.example.com/webhooks/tmh";

    await handleDelivery(payload, headers, url);
    await handleDelivery(payload, headers, url);

    expect(logged).toEqual([["handling", "learner.certified", "evt_01JD8M"]]);
    expect([...handled]).toEqual(["evt_01JD8M"]);
  });

  runs("webhook-test-delivery", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        `POST ${ORG}/webhook-subscriptions/whs_01JD8Q:test`,
        runningOperation("webhookSubscriptions:test"),
      )
      .script(
        OPERATION_ROUTE,
        doneOperation("webhookSubscriptions:test", {
          _tag: "sent",
          responseStatus: 204,
        }),
      );

    await runSample("webhook-test-delivery", fake);

    expect(logged).toEqual([["Endpoint answered", 204]]);
  });

  runs("webhook-test-headers", async () => {
    await runSample("webhook-test-headers", createFakeTransport());

    expect(logged).toEqual([
      [
        {
          eventId: "evt_01JD8M",
          eventType: "learner.certified",
          orgId: ORG_ID,
          occurredAt: "2026-11-15T12:00:00.000Z",
          data: { subjectId: LEARNER_ID, courseId: "hipaa-2026" },
        },
      ],
    ]);
  });
});

describe("operations.md", () => {
  runs("operations", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(`POST ${ORG}/learners:export`, {
        status: 202,
        json: exportOperation("learners:export", `learners-${ORG_ID}.csv`),
      });

    await runSample("operations", fake);

    const csv = "learnerId,email\r\nsub_01,ana@example.com\r\n";
    expect(logged).toEqual([[`learners-${ORG_ID}.csv`, 1, csv.length]]);
  });

  runs("operations-resume", async () => {
    const saved: string[] = [];
    vi.stubGlobal("jobs", {
      save: (name: string) => {
        saved.push(name);
        return Promise.resolve();
      },
      load: () => Promise.resolve(saved[0] ?? ""),
    });
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        `POST ${ORG}/certificates:export`,
        runningOperation("certificates:export"),
      )
      .script(OPERATION_ROUTE, {
        json: exportOperation("certificates:export", "certificates.csv"),
      });

    await runSample("operations-resume", fake);

    expect(saved).toEqual([
      `organizations/${ORG_ID}/operations/${OPERATION_ID}`,
    ]);
    expect(logged).toEqual([[1]]);
  });

  runs("csv-import", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        `POST ${ORG}/enrollments:import`,
        {
          json: {
            totalRows: 2,
            validRows: 2,
            seatsRequired: 2,
            seatsAvailable: 10,
            rows: [],
          },
        },
        doneOperation("enrollments:import", {}),
      );

    await runSample("csv-import", fake);

    const [preview, imported] = fake.requestsTo(
      `POST ${ORG}/enrollments:import`,
    );
    const options = async (body: unknown) =>
      JSON.parse(
        await ((body as FormData).get("options") as Blob).text(),
      ) as unknown;
    expect(await options(preview?.body)).toEqual({
      courseId: "hipaa-2026",
      validateOnly: true,
    });
    expect(await options(imported?.body)).toEqual({
      courseId: "hipaa-2026",
      validateOnly: false,
    });
    expect(logged).toEqual([[2, "of", 2, "rows are valid"]]);
  });

  runs("bulk-changes", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        `POST ${ORG}/enrollments:batch`,
        {
          json: {
            operation: "remind",
            results: [
              { enrollmentId: "enr_01", outcome: "succeeded" },
              { enrollmentId: "enr_02", outcome: "skipped" },
            ],
          },
        },
        doneOperation("enrollments:batch", {}),
      );

    await runSample("bulk-changes", fake);

    const [, byFilter] = fake.requestsTo(`POST ${ORG}/enrollments:batch`);
    expect(JSON.parse(textBody(byFilter))).toEqual({
      operation: "recertify",
      select: { filter: { status: "EXPIRED", courseId: "hipaa-2026" } },
    });
    expect(logged).toEqual([
      ["enr_01", "succeeded"],
      ["enr_02", "skipped"],
    ]);
  });
});

describe("writes.md: ETags and merge patches", () => {
  runs("conditional-write", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, learnerReply({ etag: '"7"' }))
      .script(`PATCH ${ORG}/learners/${LEARNER_ID}`, {
        status: 412,
        json: {
          title: "Precondition failed",
          status: 412,
          code: "precondition_failed",
        },
      });

    await runSample("conditional-write", fake);

    const [update] = fake.requestsTo(`PATCH ${ORG}/learners/${LEARNER_ID}`);
    expect(update?.headers["if-match"]).toBe('"7"');
    expect(update?.headers["content-type"]).toBe(
      "application/merge-patch+json",
    );
    expect(JSON.parse(textBody(update))).toEqual({
      name: "Ana Q. Example",
      externalId: null,
    });
    expect(logged).toEqual([
      ["Someone else changed this Learner; read it again"],
    ]);
  });

  runs("conditional-update-subscription", async () => {
    const route = `${ORG}/webhook-subscriptions/whs_01JD8Q`;
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(`GET ${route}`, {
        json: subscriptionBody,
        headers: { etag: '"3"' },
      })
      .script(`PATCH ${route}`, {
        json: { ...subscriptionBody, enabled: false, description: null },
        headers: { etag: '"4"' },
      });

    await runSample("conditional-update-subscription", fake);

    const [update] = fake.requestsTo(`PATCH ${route}`);
    expect(update?.headers["if-match"]).toBe('"3"');
    expect(JSON.parse(textBody(update))).toEqual({
      enabled: false,
      description: null,
    });
    expect(logged).toEqual([[false, '"4"']]);
  });

  runs("conditional-read", async () => {
    const fake = createFakeTransport().script(
      "GET /v1/courses/hipaa-2026",
      {
        json: { courseId: "hipaa-2026", title: "HIPAA Training 2026" },
        headers: { etag: '"c1"' },
      },
      { status: 304, headers: { etag: '"c1"' } },
    );

    await runSample("conditional-read", fake);

    const [, revalidation] = fake.requests;
    expect(revalidation?.headers["if-none-match"]).toBe('"c1"');
    expect(logged).toEqual([["HIPAA Training 2026"]]);
  });
});

describe("testing.md", () => {
  runs("testing-sandbox", async () => {
    vi.stubEnv("TMH_SANDBOX_CLIENT_ID", "cli_sandbox");
    vi.stubEnv("TMH_SANDBOX_CLIENT_SECRET", "tmh_cs_sandbox");
    const sandbox = introspectionReply();
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(INTROSPECTION_ROUTE, {
        json: { ...(sandbox.json as object), mode: "test" },
      });

    await runSample("testing-sandbox", fake);

    expect(fake.requests[0]?.url).toBe(
      "https://sandbox.api.tme.so/v1/auth/token",
    );
    expect(logged).toEqual([["test"]]);
  });

  runs("testing-fake-transport", async () => {
    const harnessFake = createFakeTransport();

    await runSample("testing-fake-transport", harnessFake);

    expect(harnessFake.requests).toEqual([]);
    expect(logged).toEqual([[0.5, 1]]);
  });

  runs("testing-mock-server", async () => {
    const fake = createFakeTransport().script(
      "GET /v1/organizations/org_acme/learners",
      page([learnerBody]),
    );

    await runSample("testing-mock-server", fake);

    expect(fake.requests[0]?.url).toBe(
      "http://127.0.0.1:4010/v1/organizations/org_acme/learners?limit=5",
    );
    expect(fake.requests[0]?.headers.authorization).toBe("Bearer mock-token");
    expect(logged).toEqual([[1]]);
  });

  runs("testing-webhook-handler", async () => {
    await runSample("testing-webhook-handler", createFakeTransport());

    expect(logged).toEqual([[200, 400, "body_hash_mismatch"]]);
  });
});

describe("client.md and errors.md: options", () => {
  runs("configuration", async () => {
    await runSample("configuration", createFakeTransport());

    expect(logged).toEqual([["function"]]);
  });

  runs("configuration-per-call", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(`GET ${ORG}/learners`, page([learnerBody]));

    await runSample("configuration-per-call", fake);

    expect(fake.requestsTo(`GET ${ORG}/learners`)[0]?.timeout).toBe(5_000);
    expect(logged).toEqual([[1]]);
  });

  runs("configuration-fetch", async () => {
    await runSample("configuration-fetch", createFakeTransport());

    expect(logged).toEqual([["function"]]);
  });

  runs("logging", async () => {
    const entries: unknown[][] = [];
    vi.spyOn(console, "debug").mockImplementation((...args: unknown[]) => {
      entries.push(args);
    });
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(`GET ${ORG}/learners`, {
        ...page([learnerBody]),
        headers: { "x-request-id": "req_list" },
      });

    await runSample("logging", fake);

    expect(entries.map(([, fields]) => fields)).toEqual([
      {
        method: "POST",
        path: "/v1/auth/token",
        status: 200,
        latencyMs: 0,
        requestId: null,
      },
      {
        method: "GET",
        path: `${ORG}/learners`,
        status: 200,
        latencyMs: 0,
        requestId: "req_list",
      },
    ]);
  });
});

describe("compatibility.md", () => {
  runs("esm-imports", async () => {
    await runSample("esm-imports", createFakeTransport());

    expect(logged).toEqual([["function", "function", "object"]]);
  });

  runs("open-enums", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, { json: { ...learnerBody, status: "on_leave" } });

    await runSample("open-enums", fake);

    expect(logged).toEqual([["needs attention:", "on_leave"]]);
  });
});
