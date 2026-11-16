// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActor } from "./audit-event-actor.js";

export interface AuditEventOrganizationReopened {
  readonly eventId: string;
  readonly at: string;
  readonly type: "organization.reopened";
  readonly actorSubjectId: string;
  readonly actor: AuditEventActor;
}
