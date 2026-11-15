// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActor } from "./audit-event-actor.js";
import type { AuditEventOauthGrantUpdatedFieldsItem } from "./audit-event-oauth-grant-updated-fields-item.js";

export interface AuditEventOauthGrantUpdated {
  readonly eventId: string;
  readonly at: string;
  readonly type: "oauth_grant.updated";
  readonly actorSubjectId: string;
  readonly actor: AuditEventActor;
  readonly appId: string;
  readonly grantId: string;
  readonly fields: readonly AuditEventOauthGrantUpdatedFieldsItem[];
}
