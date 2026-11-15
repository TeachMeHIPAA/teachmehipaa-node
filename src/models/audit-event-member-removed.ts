// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActor } from "./audit-event-actor.js";

export interface AuditEventMemberRemoved {
  readonly eventId: string;
  readonly at: string;
  readonly type: "member.removed";
  readonly actorSubjectId: string;
  readonly actor: AuditEventActor;
  readonly subjectId: string;
  readonly wasAdmin: boolean;
}
