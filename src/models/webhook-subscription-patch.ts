// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { EventType } from "./event-type.js";

/** Sent as a JSON merge patch: omit a field (or leave it `undefined`) to leave it unchanged; `null` clears a nullable field. */
export interface WebhookSubscriptionPatch {
  /** The HTTPS URL to deliver events to. */
  readonly endpointUrl?: string | undefined;
  /** The event types to deliver. */
  readonly eventTypes?: readonly EventType[] | undefined;
  /** Turn deliveries on or off. */
  readonly enabled?: boolean | undefined;
  /** A description for your own reference. */
  readonly description?: string | null | undefined;
  /** Send `seats.low` when available seats drop to this number. */
  readonly seatsLowThreshold?: number | undefined;
}
