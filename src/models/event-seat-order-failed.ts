// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { SeatOrderEventData } from "./seat-order-event-data.js";

export interface EventSeatOrderFailed {
  readonly eventId: string;
  readonly eventType: "seat_order.failed";
  readonly orgId: string;
  /** An ISO 8601 date-time string. */
  readonly occurredAt: string;
  readonly data: SeatOrderEventData;
}
