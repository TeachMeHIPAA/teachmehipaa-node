// The doc test harness: README.md and docs/guides/*.md hold TypeScript
// samples that partners copy, so every one is type-checked against the
// library and, where it can run, run against the fake transport.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { createFakeClock } from "../support/fake-clock.js";
import type { FakeTransport } from "../support/fake-transport.js";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  LEARNER_ID,
  ORG_ID,
  learnerBody,
} from "../support/fixtures.js";

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const WEBHOOK_SECRET = "readme-test-signing-secret";

export interface Sample {
  /** The Markdown file it came from, relative to the repo root. */
  readonly file: string;
  readonly id: string;
  readonly code: string;
}

/** Every ```ts block in a Markdown file, each tagged `sample=<id>`. */
export const samplesIn = (file: string): readonly Sample[] =>
  [
    ...readFileSync(`${ROOT}${file}`, "utf8").matchAll(
      /^```(ts|typescript)\b([^\n]*)\n([\s\S]*?)^```$/gm,
    ),
  ].map(([, , info = "", code = ""]) => {
    const id = /\bsample=([\w-]+)/.exec(info)?.[1];
    if (id === undefined) {
      throw new Error(
        `${file}: a TypeScript block has no sample=<id>:\n${code}`,
      );
    }
    return { file, id, code };
  });

/**
 * Samples after a doc's first one use its `client` without creating one;
 * the harness creates it, bound to an Organization so no lookup is
 * scripted.
 */
const PRELUDE = `import __TeachMeHipaa from "@teachmehipaa/node";
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

/** Stand-ins for the caller's own code that samples name in prose. */
const PLACEHOLDERS = `declare global {
  /** The Event log position a tail resumes from. */
  const cursors: {
    load(): Promise<string | undefined>;
    save(eventId: string | null): Promise<void>;
  };
  /** The caller's own record of Events already handled. */
  const processedEvents: {
    has(eventId: string): Promise<boolean>;
    add(eventId: string): Promise<void>;
  };
  /** The caller's storage for an Operation it will come back to. */
  const jobs: { save(name: string): Promise<void>; load(): Promise<string> };
  /** The caller's secret store. */
  const secrets: { put(name: string, value: string): Promise<void> };
}
export {};
`;

/**
 * Type-checks samples with the repo's compiler settings, resolving
 * "@teachmehipaa/node" to the source entry point, or with `TMH_README_TYPES=dist`
 * to the built declarations (as `npm run check:dist` does).
 */
export const typeErrors = (samples: readonly Sample[]): readonly string[] => {
  const types =
    process.env.TMH_README_TYPES === "dist"
      ? "dist/index.d.ts"
      : "src/index.ts";
  const tsconfig: unknown = ts.readConfigFile(`${ROOT}tsconfig.json`, (name) =>
    ts.sys.readFile(name),
  ).config;
  const { options } = ts.parseJsonConfigFileContent(tsconfig, ts.sys, ROOT);
  const virtualPath = (sample: Sample) =>
    `${ROOT}doc-samples/${basename(sample.file, ".md")}/${sample.id}.ts`;
  const virtual = new Map<string, string>([
    [`${ROOT}doc-samples/placeholders.d.ts`, PLACEHOLDERS],
    ...samples.map((sample): [string, string] => [
      virtualPath(sample),
      moduleSource(sample),
    ]),
  ]);
  const compilerOptions: ts.CompilerOptions = {
    ...options,
    noEmit: true,
    // Samples show one idea each, so they may leave values unused.
    noUnusedLocals: false,
    noUnusedParameters: false,
    baseUrl: ROOT,
    paths: { "@teachmehipaa/node": [types] },
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
          : `${diagnostic.file.fileName.replace(`${ROOT}doc-samples/`, "")}:${String(
              diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
                .line + 1,
            )} `;
      return `${where}${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
    });
};

const runtime = await import("./runtime.js");
export const { webhooks } = runtime;

/** What samples printed with `console.log`, reset before each test. */
export const logged: unknown[][] = [];

export interface SampleSuite {
  /** Registers a test that runs one sample; the id must be in the doc. */
  readonly runs: (id: string, test: () => Promise<void>) => void;
  /** Runs a sample against the fake transport; resolves its exports. */
  readonly runSample: (
    id: string,
    fake: FakeTransport,
  ) => Promise<Record<string, unknown>>;
  /**
   * The checks every doc gets: each sample has a unique id, is run or
   * listed as type-checked only, and type-checks.
   */
  readonly checksEverySample: (
    typeCheckedOnly: Readonly<Record<string, string>>,
  ) => void;
}

/**
 * Sets up a test file for the samples of `files`. Vitest only transforms
 * TypeScript it loads from disk, so runnable samples are written under
 * `test/readme/.generated/<name>/` (git-ignored) with "@teachmehipaa/node"
 * pointing at the runtime shim.
 */
export const sampleSuite = (
  name: string,
  files: readonly string[],
): SampleSuite => {
  const samples = files.flatMap(samplesIn);
  const generated = `${ROOT}test/readme/.generated/${name}`;
  const runnable: string[] = [];

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
    rmSync(generated, { recursive: true, force: true });
  });

  const sampleById = (id: string): Sample => {
    const sample = samples.find((candidate) => candidate.id === id);
    if (sample === undefined) {
      throw new Error(`${files.join(", ")}: no sample=${id}`);
    }
    return sample;
  };

  const runSample = async (
    id: string,
    fake: FakeTransport,
  ): Promise<Record<string, unknown>> => {
    runtime.useFakes({ transport: fake.transport, clock: createFakeClock() });
    mkdirSync(generated, { recursive: true });
    const file = `${generated}/${id}.ts`;
    writeFileSync(
      file,
      moduleSource(sampleById(id)).replaceAll(
        /from "@teachmehipaa\/node"/g,
        `from "../../runtime.js"`,
      ),
    );
    return (await import(/* @vite-ignore */ file)) as Record<string, unknown>;
  };

  return {
    runSample,
    runs: (id, test) => {
      runnable.push(id);
      it(`runs sample=${id}`, test);
    },
    checksEverySample: (typeCheckedOnly) => {
      it("tags every TypeScript sample with a unique id the test knows", () => {
        const ids = samples.map((sample) => sample.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.length).toBeGreaterThan(0);
        const covered = new Set([...Object.keys(typeCheckedOnly), ...runnable]);
        expect(ids.filter((id) => !covered.has(id))).toEqual([]);
        expect([...covered].filter((id) => !ids.includes(id))).toEqual([]);
      });

      it("type-checks every sample", () => {
        expect(typeErrors(samples)).toEqual([]);
      }, 60_000);
    },
  };
};

export const page = (
  items: readonly unknown[],
  nextCursor: string | null = null,
) => ({
  json: { items, nextCursor },
});

export const learner = (n: number) => ({
  ...learnerBody,
  learnerId: `sub_01JD80AB2C3D4E5F6G7H8J9K${String(n).padStart(2, "0")}`,
  email: `learner${String(n)}@example.com`,
});

/** `dev#/components/schemas/Operation` for a done export. */
export const exportOperation = (kind: string, filename: string) => ({
  name: `organizations/${ORG_ID}/operations/0b7d4a8e-5c1f-4e2a-9d3b-6f8a1c2e4b7d`,
  done: true,
  metadata: { kind },
  response: {
    format: "csv",
    contentType: "text/csv; charset=utf-8",
    filename,
    rowCount: 1,
    // base64 of "learnerId,email\r\nsub_01,ana@example.com\r\n"
    dataBase64: "bGVhcm5lcklkLGVtYWlsDQpzdWJfMDEsYW5hQGV4YW1wbGUuY29tDQo=",
  },
});

/** `dev#/components/schemas/OrgEventsPage` items. */
export const event = (eventId: string) => ({
  eventId,
  eventType: "learner.certified",
  orgId: ORG_ID,
  occurredAt: "2026-11-15T12:00:00.000Z",
  data: {
    learnerId: LEARNER_ID,
    email: "ana@example.com",
    externalId: "hr-123",
    courseId: "hipaa-2026",
    status: "compliant",
    occurredAt: "2026-11-15T12:00:00.000Z",
  },
});
