import { format } from "prettier";
import type { Ir } from "./ir.ts";
import { byCodePoint } from "./render.ts";

export const CODE_SAMPLES_PATH = "docs/reference/code-samples.json";

/** The API reference's language picker key for this SDK. */
const LANGUAGE = "node";

/**
 * Example values shared by every TeachMeHIPAA SDK's samples, so the same
 * operation reads the same in each language.
 */
const EXAMPLE = {
  learnerId: "sub_01JD80AB2C3D4E5F6G7H8J9K0M",
  enrollmentId: "enr_01JD8K2M4N6P8Q0R2S4T6V8W0X",
  certId: "cert_01JD8F3G5H7J9K1M3N5P7Q9R1S",
  courseId: "hipaa-2026",
  externalId: "hr-1042",
  operationId: "op_01JD8T4V6W8X0Y2Z4A6B8C0D2E",
  subscriptionId: "whs_01JD8Q5R7S9T1V3W5X7Y9Z1A3B",
  tinyId: "a7Kq2Z",
  name: "Dana Whitfield",
  email: "dana.whitfield@example.com",
  webhookUrl: "https://example.com/webhooks/teachmehipaa",
  csvFile: "roster.csv",
} as const;

const q = (value: string): string => JSON.stringify(value);

/** The client the README quickstart creates. */
const CLIENT = `const client = new TeachMeHipaa({
  clientId: process.env.TMH_CLIENT_ID!,
  clientSecret: process.env.TMH_CLIENT_SECRET!,
  environment: "sandbox",
});`;

/** A client without credentials, which can only call public methods. */
const PUBLIC_CLIENT = `const client = new TeachMeHipaa({ environment: "sandbox" });`;

interface SampleSpec {
  /** The public method the sample calls, as `resource.method`. */
  readonly method: string;
  /** The call and one line that uses its result. */
  readonly body: string;
  /** Sent without an Access token, so the client takes no credentials. */
  readonly public?: true;
  /** Extra imports the body needs, written in full. */
  readonly imports?: readonly string[];
}

const WRITE_FILE = `import { writeFile } from "node:fs/promises";`;

/**
 * One sample per operationId. Where two methods share an operationId, the
 * sample shows the first: `enrollments.batch`, `enrollments.import`.
 */
const SAMPLES: Readonly<Record<string, SampleSpec>> = {
  listAuditEvents: {
    method: "auditEvents.list",
    body: `for await (const event of client.auditEvents.list({ subjectId: ${q(EXAMPLE.learnerId)} })) {
  console.log(event.at, event.type);
}`,
  },
  introspectAccessToken: {
    method: "auth.introspect",
    body: `const token = await client.auth.introspect();
console.log(token.orgId, token.mode, token.scopes);`,
  },
  getCertificateVerification: {
    method: "certificateVerifications.retrieve",
    public: true,
    body: `const verification = await client.certificateVerifications.retrieve(${q(EXAMPLE.tinyId)});
console.log(verification.status, verification.learnerName);`,
  },
  downloadCertificatePdf: {
    method: "certificates.downloadPdf",
    imports: [WRITE_FILE],
    body: `const pdf = await client.certificates.downloadPdf(${q(EXAMPLE.certId)});
await writeFile(pdf.filename ?? "certificate.pdf", pdf.data);`,
  },
  exportCertificates: {
    method: "certificates.export",
    imports: [WRITE_FILE],
    body: `const operation = await client.certificates.export({ format: "csv" });
const done = await operation.wait();
await writeFile("certificates.csv", done.exportResult().csv);`,
  },
  listCertificates: {
    method: "certificates.list",
    body: `for await (const certificate of client.certificates.list({ subjectId: ${q(EXAMPLE.learnerId)} })) {
  console.log(certificate.certificateId, certificate.status);
}`,
  },
  getCertificate: {
    method: "certificates.retrieve",
    body: `const certificate = await client.certificates.retrieve(${q(EXAMPLE.certId)});
console.log(certificate.status, certificate.expiresAt);`,
  },
  getCertificateCredentials: {
    method: "certificates.retrieveLinks",
    body: `const links = await client.certificates.retrieveLinks(${q(EXAMPLE.certId)});
console.log(links.shortLink);`,
  },
  getComplianceSummary: {
    method: "compliance.retrieve",
    body: `const summary = await client.compliance.retrieve({ courseId: ${q(EXAMPLE.courseId)} });
console.log(summary.totals.compliant, "of", summary.totals.learners);`,
  },
  listCourses: {
    method: "courses.list",
    public: true,
    body: `for await (const course of client.courses.list()) {
  console.log(course.courseId, course.title);
}`,
  },
  getCourse: {
    method: "courses.retrieve",
    public: true,
    body: `const course = await client.courses.retrieve(${q(EXAMPLE.courseId)});
console.log(course.title, course.passingThreshold);`,
  },
  batchEnrollments: {
    method: "enrollments.batch",
    body: `const batch = await client.enrollments.batch({
  operation: "remind",
  select: { enrollmentIds: [${q(EXAMPLE.enrollmentId)}] },
});
for (const result of batch.results) {
  console.log(result.enrollmentId, result.outcome);
}`,
  },
  cancelEnrollment: {
    method: "enrollments.cancel",
    body: `const enrollment = await client.enrollments.cancel(${q(EXAMPLE.enrollmentId)}, { refund: true });
console.log(enrollment.status);`,
  },
  createEnrollment: {
    method: "enrollments.create",
    body: `const enrollment = await client.enrollments.create({
  email: ${q(EXAMPLE.email)},
  courseId: ${q(EXAMPLE.courseId)},
});
console.log(enrollment.enrollmentId, enrollment.status);`,
  },
  exportEnrollments: {
    method: "enrollments.export",
    imports: [WRITE_FILE],
    body: `const operation = await client.enrollments.export({ format: "csv" });
const done = await operation.wait();
await writeFile("enrollments.csv", done.exportResult().csv);`,
  },
  importEnrollments: {
    method: "enrollments.import",
    body: `const operation = await client.enrollments.import({
  file: ${q(EXAMPLE.csvFile)},
  options: { courseId: ${q(EXAMPLE.courseId)} },
});
const done = await operation.wait();
console.log(done.name, done.done);`,
  },
  listEnrollments: {
    method: "enrollments.list",
    body: `for await (const enrollment of client.enrollments.list({ status: "EXPIRING" })) {
  console.log(enrollment.enrollmentId, enrollment.expiresAt);
}`,
  },
  remindEnrollment: {
    method: "enrollments.remind",
    body: `const accepted = await client.enrollments.remind(${q(EXAMPLE.enrollmentId)});
console.log(accepted.action);`,
  },
  renewEnrollment: {
    method: "enrollments.renew",
    body: `const enrollment = await client.enrollments.renew(${q(EXAMPLE.enrollmentId)});
console.log(enrollment.cycle, enrollment.status);`,
  },
  resendEnrollmentInvite: {
    method: "enrollments.resendInvite",
    body: `const accepted = await client.enrollments.resendInvite(${q(EXAMPLE.enrollmentId)});
console.log(accepted.action);`,
  },
  getEnrollment: {
    method: "enrollments.retrieve",
    body: `const enrollment = await client.enrollments.retrieve(${q(EXAMPLE.enrollmentId)});
console.log(enrollment.status, enrollment.certificateId);`,
  },
  listOrgEvents: {
    method: "events.list",
    body: `for await (const event of client.events.list({ type: "learner.certified" })) {
  console.log(event.eventId, event.occurredAt);
}`,
  },
  batchUpsertLearners: {
    method: "learners.batchUpsert",
    body: `const operation = await client.learners.batchUpsert({
  items: [{ email: ${q(EXAMPLE.email)}, externalId: ${q(EXAMPLE.externalId)} }],
});
const done = await operation.wait();
console.log(done.name, done.done);`,
  },
  createLearner: {
    method: "learners.create",
    body: `const learner = await client.learners.create({
  email: ${q(EXAMPLE.email)},
  name: ${q(EXAMPLE.name)},
});
console.log(learner.learnerId, learner.created);`,
  },
  createLearnerLaunchLink: {
    method: "learners.createLaunchLink",
    body: `const link = await client.learners.createLaunchLink(${q(EXAMPLE.learnerId)});
console.log(link.url, link.expiresAt);`,
  },
  exportLearners: {
    method: "learners.export",
    imports: [WRITE_FILE],
    body: `const operation = await client.learners.export({ format: "csv" });
const done = await operation.wait();
await writeFile("learners.csv", done.exportResult().csv);`,
  },
  listLearners: {
    method: "learners.list",
    body: `for await (const learner of client.learners.list({ status: "in_progress" })) {
  console.log(learner.learnerId, learner.email);
}`,
  },
  offboardLearner: {
    method: "learners.offboard",
    body: `const learner = await client.learners.offboard(${q(EXAMPLE.learnerId)});
console.log(learner.status);`,
  },
  remindLearner: {
    method: "learners.remind",
    body: `const accepted = await client.learners.remind(${q(EXAMPLE.learnerId)});
console.log(accepted.action);`,
  },
  getLearner: {
    method: "learners.retrieve",
    body: `const learner = await client.learners.retrieve(${q(EXAMPLE.learnerId)});
console.log(learner.name, learner.status);`,
  },
  updateLearner: {
    method: "learners.update",
    body: `const current = await client.learners.retrieve(${q(EXAMPLE.learnerId)});
const learner = await client.learners.update(
  current.learnerId,
  { externalId: ${q(EXAMPLE.externalId)} },
  { ifMatch: current },
);
console.log(learner.externalId);`,
  },
  upsertLearnerByExternalId: {
    method: "learners.upsertByExternalId",
    body: `const learner = await client.learners.upsertByExternalId(${q(EXAMPLE.externalId)}, {
  email: ${q(EXAMPLE.email)},
  name: ${q(EXAMPLE.name)},
});
console.log(learner.learnerId, learner.created);`,
  },
  listMembers: {
    method: "members.list",
    body: `for await (const member of client.members.list({ role: "admin" })) {
  console.log(member.email, member.role);
}`,
  },
  getMember: {
    method: "members.retrieve",
    body: `const member = await client.members.retrieve(${q(EXAMPLE.learnerId)});
console.log(member.email, member.role);`,
  },
  getOperation: {
    method: "operations.retrieve",
    body: `const operation = await client.operations.retrieve(${q(EXAMPLE.operationId)});
console.log(operation.done, operation.error?.code);`,
  },
  getSeatInventory: {
    method: "seats.retrieve",
    body: `const seats = await client.seats.retrieve();
console.log(seats.available, "of", seats.total);`,
  },
  createWebhookSubscription: {
    method: "webhookSubscriptions.create",
    body: `const subscription = await client.webhookSubscriptions.create({
  endpointUrl: ${q(EXAMPLE.webhookUrl)},
  eventTypes: ["learner.certified"],
});
// The API returns subscription.secret only here: store it now.
console.log(subscription.subscriptionId, subscription.secretKeyId);`,
  },
  deleteWebhookSubscription: {
    method: "webhookSubscriptions.delete",
    body: `const deleted = await client.webhookSubscriptions.delete(${q(EXAMPLE.subscriptionId)});
console.log(deleted.lastResponse.status);`,
  },
  listWebhookSubscriptions: {
    method: "webhookSubscriptions.list",
    body: `for await (const subscription of client.webhookSubscriptions.list()) {
  console.log(subscription.subscriptionId, subscription.endpointUrl);
}`,
  },
  redriveWebhookSubscription: {
    method: "webhookSubscriptions.redrive",
    body: `const operation = await client.webhookSubscriptions.redrive(${q(EXAMPLE.subscriptionId)});
const done = await operation.wait();
console.log(done.response?._tag);`,
  },
  getWebhookSubscription: {
    method: "webhookSubscriptions.retrieve",
    body: `const subscription = await client.webhookSubscriptions.retrieve(${q(EXAMPLE.subscriptionId)});
console.log(subscription.endpointUrl, subscription.enabled);`,
  },
  testWebhookSubscription: {
    method: "webhookSubscriptions.test",
    body: `const operation = await client.webhookSubscriptions.test(${q(EXAMPLE.subscriptionId)});
const done = await operation.wait();
console.log(done.response?._tag);`,
  },
  updateWebhookSubscription: {
    method: "webhookSubscriptions.update",
    body: `const current = await client.webhookSubscriptions.retrieve(${q(EXAMPLE.subscriptionId)});
const subscription = await client.webhookSubscriptions.update(
  current.subscriptionId,
  { enabled: false },
  { ifMatch: current },
);
console.log(subscription.enabled);`,
  },
};

/**
 * The method each operationId's sample must call: the IR's first method
 * for it, in IR order.
 */
const firstMethods = (ir: Ir): ReadonlyMap<string, string> =>
  ir.resources
    .flatMap((resource) =>
      resource.methods.map(
        (method) =>
          [
            method.operationId,
            [...resource.path, method.name].join("."),
          ] as const,
      ),
    )
    .reduce(
      (methods, [operationId, name]) =>
        methods.has(operationId)
          ? methods
          : new Map([...methods, [operationId, name]]),
      new Map<string, string>(),
    );

const source = (spec: SampleSpec): string =>
  [
    [
      ...(spec.imports ?? []),
      `import TeachMeHipaa from "@teachmehipaa/node";`,
    ].join("\n"),
    spec.public === true ? PUBLIC_CLIENT : CLIENT,
    spec.body,
  ].join("\n\n");

/**
 * `docs/reference/code-samples.json`: one complete program per operationId,
 * which the monorepo's API reference shows under "Node". Throws when the
 * table and the IR disagree, so a new operation can't ship without one.
 */
export const generateCodeSamples = async (
  ir: Ir,
): Promise<ReadonlyMap<string, string>> => {
  const methods = firstMethods(ir);
  const missing = [...methods.keys()].filter((id) => !(id in SAMPLES));
  const extra = Object.keys(SAMPLES).filter((id) => !methods.has(id));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `code samples: missing ${JSON.stringify(missing)}, unknown ${JSON.stringify(extra)}`,
    );
  }
  const entries = await Promise.all(
    [...methods].map(async ([operationId, method]) => {
      const spec = SAMPLES[operationId];
      if (spec?.method !== method) {
        throw new Error(
          `code samples: ${operationId} must call ${method}, not ${String(spec?.method)}`,
        );
      }
      const code = await format(source(spec), { parser: "typescript" });
      return [operationId, code] as const;
    }),
  );
  const samples = Object.fromEntries(
    [...entries].sort(([a], [b]) => byCodePoint(a, b)),
  );
  const json = { language: LANGUAGE, release: ir.source.release, samples };
  return new Map([[CODE_SAMPLES_PATH, `${JSON.stringify(json, null, 2)}\n`]]);
};
