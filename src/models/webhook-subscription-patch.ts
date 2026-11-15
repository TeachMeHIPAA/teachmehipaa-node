// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { EventType } from "./event-type.js";

/** Sent as a JSON merge patch: omit a field to leave it unchanged; `null` clears a nullable field. */
export interface WebhookSubscriptionPatch {
  /** The HTTPS URL to deliver events to. */
  readonly endpointUrl?: string;
  /** The event types to deliver. */
  readonly eventTypes?: readonly EventType[];
  /** Turn deliveries on or off. */
  readonly enabled?: boolean;
  /** A description for your own reference. */
  readonly description?: string | null;
  /** Send `seats.low` when available seats drop to this number. */
  readonly seatsLowThreshold?: number;
}
