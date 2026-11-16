// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActor } from "./audit-event-actor.js";

export interface AuditEventMemberTransferred {
  readonly eventId: string;
  readonly at: string;
  readonly type: "member.transferred";
  readonly actorSubjectId: string;
  readonly actor: AuditEventActor;
  readonly subjectId: string;
  readonly targetOrgId: string;
}
