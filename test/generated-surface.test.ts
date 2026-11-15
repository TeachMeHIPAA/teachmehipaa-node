import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GENERATED_DIRECTORIES, generate } from "../scripts/generator/index.ts";
import { validateIr } from "../scripts/generator/validate.ts";
import TeachMeHipaa from "../src/index.js";
import { CLIENT_ID, CLIENT_SECRET } from "./support/fixtures.js";

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

/**
 * The public method for every Developer API operation: research
 * `api-sdk-surface.md` §11, with the renames settled since (grilling Q12:
 * `retrieveLinks`; the IR: `auth.introspect` and `delete` over `del`) and the
 * Q25 splits of `importEnrollments` and `batchEnrollments`.
 */
const EXPECTED_METHODS: Readonly<Record<string, readonly string[]>> = {
  listAuditEvents: ["auditEvents.list"],
  introspectAccessToken: ["auth.introspect"],
  getCertificateVerification: ["certificateVerifications.retrieve"],
  downloadCertificatePdf: ["certificates.downloadPdf"],
  exportCertificates: ["certificates.export"],
  listCertificates: ["certificates.list"],
  getCertificate: ["certificates.retrieve"],
  getCertificateCredentials: ["certificates.retrieveLinks"],
  getComplianceSummary: ["compliance.retrieve"],
  listCourses: ["courses.list"],
  getCourse: ["courses.retrieve"],
  batchEnrollments: ["enrollments.batch", "enrollments.batchByFilter"],
  cancelEnrollment: ["enrollments.cancel"],
  createEnrollment: ["enrollments.create"],
  exportEnrollments: ["enrollments.export"],
  importEnrollments: ["enrollments.import", "enrollments.previewImport"],
  listEnrollments: ["enrollments.list"],
  remindEnrollment: ["enrollments.remind"],
  renewEnrollment: ["enrollments.renew"],
  resendEnrollmentInvite: ["enrollments.resendInvite"],
  getEnrollment: ["enrollments.retrieve"],
  listOrgEvents: ["events.list"],
  batchUpsertLearners: ["learners.batchUpsert"],
  createLearner: ["learners.create"],
  createLearnerLaunchLink: ["learners.createLaunchLink"],
  exportLearners: ["learners.export"],
  listLearners: ["learners.list"],
  offboardLearner: ["learners.offboard"],
  remindLearner: ["learners.remind"],
  getLearner: ["learners.retrieve"],
  updateLearner: ["learners.update"],
  upsertLearnerByExternalId: ["learners.upsertByExternalId"],
  listMembers: ["members.list"],
  getMember: ["members.retrieve"],
  getOperation: ["operations.retrieve"],
  createPartnerOrganization: ["partners.organizations.create"],
  listPartnerOrganizations: ["partners.organizations.list"],
  getPartner: ["partners.retrieve"],
  confirmPaymentMethod: ["paymentMethod.confirm"],
  removePaymentMethod: ["paymentMethod.delete"],
  preparePaymentMethod: ["paymentMethod.prepare"],
  getPaymentMethod: ["paymentMethod.retrieve"],
  setupPaymentMethod: ["paymentMethod.setup"],
  createSeatOrder: ["seatOrders.create"],
  listSeatOrders: ["seatOrders.list"],
  quoteSeatOrder: ["seatOrders.quote"],
  getSeatOrder: ["seatOrders.retrieve"],
  getSeatInventory: ["seats.retrieve"],
  createWebhookSubscription: ["webhookSubscriptions.create"],
  deleteWebhookSubscription: ["webhookSubscriptions.delete"],
  listWebhookSubscriptions: ["webhookSubscriptions.list"],
  redriveWebhookSubscription: ["webhookSubscriptions.redrive"],
  getWebhookSubscription: ["webhookSubscriptions.retrieve"],
  testWebhookSubscription: ["webhookSubscriptions.test"],
  updateWebhookSubscription: ["webhookSubscriptions.update"],
};

/** The token endpoint is implemented by the core's token providers. */
const HAND_WRITTEN_OPERATIONS = ["createAccessToken"];

/**
 * Public methods with no operation of their own, from `src/extensions/`:
 * `events.tail` iterates `listOrgEvents` (grilling Q22).
 */
const HAND_WRITTEN_METHODS = ["events.tail"];

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

const specOperationIds = (): readonly string[] => {
  const spec = readJson("../openapi/openapi.developer.json") as {
    readonly paths: Record<string, Record<string, { operationId?: string }>>;
  };
  return Object.values(spec.paths).flatMap((item) =>
    HTTP_METHODS.flatMap((method) => {
      const operationId = item[method]?.operationId;
      return operationId === undefined ? [] : [operationId];
    }),
  );
};

const irMethods = (): readonly { name: string; operationId: string }[] => {
  const ir = readJson("../openapi/sdk-ir.json") as {
    readonly resources: readonly {
      readonly path: readonly string[];
      readonly methods: readonly { name: string; operationId: string }[];
    }[];
  };
  return ir.resources.flatMap((resource) =>
    resource.methods.map((method) => ({
      name: [...resource.path, method.name].join("."),
      operationId: method.operationId,
    })),
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Method names on a prototype and the prototypes it extends. */
const prototypeMethods = (prototype: unknown): string[] =>
  isRecord(prototype) && prototype !== Object.prototype
    ? [
        ...Object.getOwnPropertyNames(prototype).filter(
          (name) =>
            name !== "constructor" &&
            typeof Reflect.get(prototype, name) === "function",
        ),
        ...prototypeMethods(Object.getPrototypeOf(prototype)),
      ]
    : [];

/** Every callable reachable from the client, as `resource.method` paths. */
const publicMethods = (target: object, prefix: string): string[] => {
  const ownProperties = Object.keys(target).flatMap((key) => {
    const value: unknown = Reflect.get(target, key);
    return isRecord(value) ? publicMethods(value, `${prefix}${key}.`) : [];
  });
  const methods = prototypeMethods(Object.getPrototypeOf(target));
  return [...ownProperties, ...methods.map((name) => `${prefix}${name}`)];
};

describe("Generated surface", () => {
  const client = new TeachMeHipaa({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
  });

  it("reads an IR built from the vendored spec", () => {
    const spec = readFileSync(
      new URL("../openapi/openapi.developer.json", import.meta.url),
    );
    const ir = readJson("../openapi/sdk-ir.json") as {
      readonly source: { readonly sha256: string; readonly release: string };
    };

    expect(createHash("sha256").update(spec).digest("hex")).toBe(
      ir.source.sha256,
    );
    expect(
      readFileSync(
        new URL("../OPENAPI_VERSION", import.meta.url),
        "utf8",
      ).trim(),
    ).toBe(ir.source.release);
  });

  it("covers every Developer API operation except the token endpoint", () => {
    const covered = specOperationIds().filter(
      (operationId) => !HAND_WRITTEN_OPERATIONS.includes(operationId),
    );

    expect(covered).toHaveLength(55);
    expect([...covered].sort()).toEqual(Object.keys(EXPECTED_METHODS).sort());
  });

  it("exposes exactly one public method per IR method, with the expected name, plus the hand-written ones", () => {
    const expected = Object.values(EXPECTED_METHODS).flat();

    expect(expected).toHaveLength(57);
    expect(publicMethods(client, "").sort()).toEqual(
      [...expected, ...HAND_WRITTEN_METHODS].sort(),
    );
  });

  it("names each IR method as its operation's expected public method", () => {
    const named = irMethods().map(({ name, operationId }) => ({
      name,
      expected: EXPECTED_METHODS[operationId] ?? [],
    }));

    named.forEach(({ name, expected }) => {
      expect(expected).toContain(name);
    });
    expect(new Set(named.map(({ name }) => name)).size).toBe(57);
  });

  it("is exactly what `npm run generate` writes from the vendored IR", async () => {
    const repoRoot = fileURLToPath(new URL("..", import.meta.url));
    const ir = validateIr(
      readJson("../openapi/sdk-ir.json"),
      readJson("../openapi/sdk-ir.schema.json") as object,
    );

    const files = await generate(ir, repoRoot);

    const committed = GENERATED_DIRECTORIES.flatMap((directory) =>
      readdirSync(new URL(`../${directory}`, import.meta.url)).map(
        (name) => `${directory}/${name}`,
      ),
    );
    expect(committed.sort()).toEqual([...files.keys()].sort());
    files.forEach((source, path) => {
      expect(readFileSync(new URL(`../${path}`, import.meta.url), "utf8")).toBe(
        source,
      );
    });
  });
});
