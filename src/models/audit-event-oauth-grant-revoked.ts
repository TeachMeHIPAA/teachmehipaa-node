// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActor } from "./audit-event-actor.js";
import type { AuditEventOauthGrantRevokedReason } from "./audit-event-oauth-grant-revoked-reason.js";

export interface AuditEventOauthGrantRevoked {
  readonly eventId: string;
  readonly at: string;
  readonly type: "oauth_grant.revoked";
  readonly actorSubjectId: string;
  readonly actor: AuditEventActor;
  readonly appId: string;
  readonly grantId: string;
  readonly reason: AuditEventOauthGrantRevokedReason;
}
