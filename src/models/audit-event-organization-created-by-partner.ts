// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActor } from "./audit-event-actor.js";

export interface AuditEventOrganizationCreatedByPartner {
  readonly eventId: string;
  readonly at: string;
  readonly type: "organization.created_by_partner";
  readonly actorSubjectId: string;
  readonly actor: AuditEventActor;
  readonly partnerId: string;
  readonly appId: string;
  readonly grantId: string;
}
