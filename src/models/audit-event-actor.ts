// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActorAgent } from "./audit-event-actor-agent.js";
import type { AuditEventActorClient } from "./audit-event-actor-client.js";
import type { AuditEventActorScim } from "./audit-event-actor-scim.js";
import type { AuditEventActorUser } from "./audit-event-actor-user.js";

/** Tell the variants apart by `type`. New variants may be added; handle values you don't recognize. */
export type AuditEventActor =
  | AuditEventActorAgent
  | AuditEventActorClient
  | AuditEventActorScim
  | AuditEventActorUser;
