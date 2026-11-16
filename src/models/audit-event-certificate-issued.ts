// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActor } from "./audit-event-actor.js";

export interface AuditEventCertificateIssued {
  readonly eventId: string;
  readonly at: string;
  readonly type: "certificate.issued";
  readonly actorSubjectId: string;
  readonly actor: AuditEventActor;
  readonly certificateId: string;
  readonly subjectId: string | null;
  readonly courseId: string;
}
