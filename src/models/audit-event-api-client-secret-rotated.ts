// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActor } from "./audit-event-actor.js";

export interface AuditEventApiClientSecretRotated {
  readonly eventId: string;
  readonly at: string;
  readonly type: "api_client.secret_rotated";
  readonly actorSubjectId: string;
  readonly actor: AuditEventActor;
  readonly clientId: string;
}
