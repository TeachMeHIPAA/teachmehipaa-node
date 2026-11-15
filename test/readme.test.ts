import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createFakeClock } from "./support/fake-clock.js";
import {
  createFakeTransport,
  textBody,
  type FakeTransport,
} from "./support/fake-transport.js";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  INTROSPECTION_ROUTE,
  LEARNER_ID,
  LEARNER_ROUTE,
  ORG_ID,
  ORG,
  TOKEN_ROUTE,
  introspectionReply,
  learnerBody,
  learnerReply,
  tokenReply,
} from "./support/fixtures.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const README = readFileSync(`${ROOT}README.md`, "utf8");
const WEBHOOK_SECRET = "readme-test-signing-secret";

interface Sample {
  readonly id: string;
  readonly code: string;
}

/** Every ```ts block, each tagged `sample=<id>` in its info string. */
const samples: readonly Sample[] = [
  ...README.matchAll(/^```(ts|typescript)\b([^\n]*)\n([\s\S]*?)^```$/gm),
].map(([, , info = "", code = ""]) => {
  const id = /\bsample=([\w-]+)/.exec(info)?.[1];
  if (id === undefined) {
    throw new Error(`README: a TypeScript block has no sample=<id>:\n${code}`);
  }
  return { id, code };
});

/**
 * Samples after the Quickstart use its `client` without creating one; the
 * harness creates it, bound to an Organization so no lookup is scripted.
 */
const PRELUDE = `import __TeachMeHipaa from "teachmehipaa";
const client = new __TeachMeHipaa({
  clientId: process.env.TMH_CLIENT_ID!,
  clientSecret: process.env.TMH_CLIENT_SECRET!,
  environment: "sandbox",
  organizationId: "${ORG_ID}",
});
`;

const moduleSource = ({ code }: Sample): string => {
  const needsClient = /\bclient\./.test(code) && !/\bconst client\b/.test(code);
  // `export {}` makes every sample a module, so top-level await is allowed.
  return `${needsClient ? PRELUDE : ""}${code}\nexport {};\n`;
};

/** Stand-ins for the caller's own storage that samples name in prose. */
const PLACEHOLDERS = `declare global {
  /** The Event log position a tail resumes from. */
  const cursors: {
    load(): Promise<string | undefined>;
    save(eventId: string | null): Promise<void>;
  };
}
export {};
`;

/**
 * Type-checks every sample with the repo's compiler settings, resolving
 * "teachmehipaa" to the source entry point, or with `TMH_README_TYPES=dist`
 * to the built declarations (as `npm run check:dist` does).
 */
const typeErrors = (): readonly string[] => {
  const types =
    process.env.TMH_README_TYPES === "dist"
      ? "dist/index.d.ts"
      : "src/index.ts";
  const tsconfig: unknown = ts.readConfigFile(`${ROOT}tsconfig.json`, (name) =>
    ts.sys.readFile(name),
  ).config;
  const { options } = ts.parseJsonConfigFileContent(tsconfig, ts.sys, ROOT);
  const virtual = new Map<string, string>([
    [`${ROOT}readme-samples/placeholders.d.ts`, PLACEHOLDERS],
    ...samples.map((sample): [string, string] => [
      `${ROOT}readme-samples/${sample.id}.ts`,
      moduleSource(sample),
    ]),
  ]);
  const compilerOptions: ts.CompilerOptions = {
    ...options,
    noEmit: true,
    // Samples show one idea each, so they may leave values unused.
    noUnusedLocals: false,
    baseUrl: ROOT,
    paths: { teachmehipaa: [types] },
  };
  const host = ts.createCompilerHost(compilerOptions);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  host.readFile = (name) => virtual.get(name) ?? readFile(name);
  host.fileExists = (name) => virtual.has(name) || fileExists(name);
  host.getSourceFile = (name, languageVersion, ...rest) => {
    const text = virtual.get(name);
    return text === undefined
      ? getSourceFile(name, languageVersion, ...rest)
      : ts.createSourceFile(name, text, languageVersion, true);
  };
  const program = ts.createProgram([...virtual.keys()], compilerOptions, host);
  return ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => {
      const file = diagnostic.file?.fileName;
      return file === undefined || virtual.has(file);
    })
    .map((diagnostic) => {
      const where =
        diagnostic.file === undefined || diagnostic.start === undefined
          ? ""
          : `${diagnostic.file.fileName.replace(`${ROOT}readme-samples/`, "")}:${String(
              diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
                .line + 1,
            )} `;
      return `${where}${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
    });
};

// Vitest only transforms TypeScript it loads from disk, so runnable samples
// are written here (git-ignored) with "teachmehipaa" pointing at the shim.
const GENERATED = `${ROOT}test/readme/.generated`;
const runtime = await import("./readme/runtime.js");

const sampleById = (id: string): Sample => {
  const sample = samples.find((candidate) => candidate.id === id);
  if (sample === undefined) {
    throw new Error(`README has no sample=${id}`);
  }
  return sample;
};

const runSample = async (
  id: string,
  fake: FakeTransport,
): Promise<Record<string, unknown>> => {
  runtime.useFakes({ transport: fake.transport, clock: createFakeClock() });
  mkdirSync(GENERATED, { recursive: true });
  const file = `${GENERATED}/${id}.ts`;
  writeFileSync(
    file,
    moduleSource(sampleById(id)).replaceAll(
      /from "teachmehipaa"/g,
      `from "../runtime.js"`,
    ),
  );
  return (await import(/* @vite-ignore */ file)) as Record<string, unknown>;
};

const logged: unknown[][] = [];

beforeEach(() => {
  logged.length = 0;
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logged.push(args);
  });
  vi.stubEnv("TMH_CLIENT_ID", CLIENT_ID);
  vi.stubEnv("TMH_CLIENT_SECRET", CLIENT_SECRET);
  vi.stubEnv("TMH_WEBHOOK_SECRET", WEBHOOK_SECRET);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

afterAll(() => {
  rmSync(GENERATED, { recursive: true, force: true });
});

/** Samples that can't run against a fake transport, and why. */
const TYPE_CHECKED_ONLY: Readonly<Record<string, string>> = {
  files: "reads and writes files on disk",
  "webhook-express": "starts an Express server",
};

const page = (items: readonly unknown[], nextCursor: string | null = null) => ({
  json: { items, nextCursor },
});

const learner = (n: number) => ({
  ...learnerBody,
  learnerId: `sub_01JD80AB2C3D4E5F6G7H8J9K${String(n).padStart(2, "0")}`,
  email: `learner${String(n)}@example.com`,
});

/** `dev#/components/schemas/Operation` for a done learners export. */
const exportOperation = {
  name: `organizations/${ORG_ID}/operations/0b7d4a8e-5c1f-4e2a-9d3b-6f8a1c2e4b7d`,
  done: true,
  metadata: { kind: "learners:export" },
  response: {
    format: "csv",
    contentType: "text/csv; charset=utf-8",
    filename: `learners-${ORG_ID}.csv`,
    rowCount: 1,
    // base64 of "learnerId,email\r\nsub_01,ana@example.com\r\n"
    dataBase64: "bGVhcm5lcklkLGVtYWlsDQpzdWJfMDEsYW5hQGV4YW1wbGUuY29tDQo=",
  },
};

/** `dev#/components/schemas/OrgEventsPage` items. */
const event = (eventId: string) => ({
  eventId,
  eventType: "learner.certified",
  orgId: ORG_ID,
  occurredAt: "2026-11-15T12:00:00.000Z",
  data: { subjectId: LEARNER_ID, courseId: "hipaa-2026" },
});

describe("README", () => {
  it("tags every TypeScript sample with a unique id the test knows", () => {
    const ids = samples.map((sample) => sample.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(0);
    const covered = new Set([
      ...Object.keys(TYPE_CHECKED_ONLY),
      ...RUNNABLE_IDS,
    ]);
    expect(ids.filter((id) => !covered.has(id))).toEqual([]);
    expect([...covered].filter((id) => !ids.includes(id))).toEqual([]);
  });

  it("type-checks every sample", () => {
    expect(typeErrors()).toEqual([]);
  }, 60_000);
});

const RUNNABLE_IDS: string[] = [];
const runs = (id: string, test: () => Promise<void>) => {
  RUNNABLE_IDS.push(id);
  it(`runs sample=${id}`, test);
};

describe("README samples, run against a fake transport", () => {
  runs("quickstart", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(INTROSPECTION_ROUTE, introspectionReply())
      .script(LEARNER_ROUTE, learnerReply())
      .script(`GET ${ORG}/learners`, page([learnerBody]));

    await runSample("quickstart", fake);

    expect(logged).toEqual([
      ["Ana Example", "in_progress"],
      ["ana@example.com"],
    ]);
    expect(fake.requests[0]?.url).toBe(
      "https://api-teachmehipaa-dev.web.app/v1/auth/token",
    );
    const list = new URL(fake.requestsTo(`GET ${ORG}/learners`)[0]?.url ?? "");
    expect(Object.fromEntries(list.searchParams)).toEqual({
      status: "in_progress",
      limit: "20",
    });
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

  runs("learner-writes", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(`POST ${ORG}/learners`, { status: 201, json: learnerBody })
      .script(`PUT ${ORG}/learners/by-external-id/hr-123`, {
        status: 200,
        json: learnerBody,
      });

    await runSample("learner-writes", fake);

    expect(logged).toEqual([["invited"], [LEARNER_ID]]);
  });

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

  runs("operations", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(`POST ${ORG}/learners:export`, {
        status: 202,
        json: exportOperation,
      });

    await runSample("operations", fake);

    const csv = "learnerId,email\r\nsub_01,ana@example.com\r\n";
    expect(logged).toEqual([[`learners-${ORG_ID}.csv`, 1, csv.length]]);
  });

  runs("webhook-fetch", async () => {
    const { webhooks } = runtime;
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

  runs("configuration", async () => {
    const fake = createFakeTransport();

    await runSample("configuration", fake);

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
