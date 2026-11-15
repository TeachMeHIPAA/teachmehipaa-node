// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActor } from "./audit-event-actor.js";
import type { AuditEventApiClientUpdatedFieldsItem } from "./audit-event-api-client-updated-fields-item.js";

export interface AuditEventApiClientUpdated {
  readonly eventId: string;
  readonly at: string;
  readonly type: "api_client.updated";
  readonly actorSubjectId: string;
  readonly actor: AuditEventActor;
  readonly clientId: string;
  readonly fields: readonly AuditEventApiClientUpdatedFieldsItem[];
}
