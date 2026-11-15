// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActor } from "./audit-event-actor.js";
import type { AuditEventPaymentMethod } from "./audit-event-payment-method.js";

export interface AuditEventSeatOrderFailed {
  readonly eventId: string;
  readonly at: string;
  readonly actorSubjectId: string;
  readonly actor: AuditEventActor;
  readonly seatOrderId: string;
  readonly quantity: number;
  readonly paymentMethod: AuditEventPaymentMethod;
  readonly type: "seat_order.failed";
  readonly failureCode: string | null;
}
