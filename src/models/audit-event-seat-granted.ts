// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActor } from "./audit-event-actor.js";

export interface AuditEventSeatGranted {
  readonly eventId: string;
  readonly at: string;
  readonly type: "seat.granted";
  readonly actorSubjectId: string;
  readonly actor: AuditEventActor;
  readonly quantity: number;
}
