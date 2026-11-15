// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActor } from "./audit-event-actor.js";
import type { AuditEventMemberRoleChangedRoleFrom } from "./audit-event-member-role-changed-role-from.js";
import type { AuditEventMemberRoleChangedRoleTo } from "./audit-event-member-role-changed-role-to.js";

export interface AuditEventMemberRoleChanged {
  readonly eventId: string;
  readonly at: string;
  readonly type: "member.role_changed";
  readonly actorSubjectId: string;
  readonly actor: AuditEventActor;
  readonly subjectId: string;
  readonly roleFrom: AuditEventMemberRoleChangedRoleFrom;
  readonly roleTo: AuditEventMemberRoleChangedRoleTo;
}
