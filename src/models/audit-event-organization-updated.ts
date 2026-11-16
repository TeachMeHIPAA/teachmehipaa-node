// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActor } from "./audit-event-actor.js";
import type { AuditEventOrganizationUpdatedFieldsItem } from "./audit-event-organization-updated-fields-item.js";

export interface AuditEventOrganizationUpdated {
  readonly eventId: string;
  readonly at: string;
  readonly type: "organization.updated";
  readonly actorSubjectId: string;
  readonly actor: AuditEventActor;
  readonly fields: readonly AuditEventOrganizationUpdatedFieldsItem[];
}
