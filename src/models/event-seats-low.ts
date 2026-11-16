// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { SeatsLowEventData } from "./seats-low-event-data.js";

export interface EventSeatsLow {
  readonly eventId: string;
  readonly eventType: "seats.low";
  readonly orgId: string;
  /** An ISO 8601 date-time string. */
  readonly occurredAt: string;
  readonly data: SeatsLowEventData;
}
