// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActor } from "./audit-event-actor.js";
import type { AuditEventOauthGrantCreatedScopesItem } from "./audit-event-oauth-grant-created-scopes-item.js";

export interface AuditEventOauthGrantCreated {
  readonly eventId: string;
  readonly at: string;
  readonly type: "oauth_grant.created";
  readonly actorSubjectId: string;
  readonly actor: AuditEventActor;
  readonly appId: string;
  readonly grantId: string;
  readonly scopes: readonly AuditEventOauthGrantCreatedScopesItem[];
}
