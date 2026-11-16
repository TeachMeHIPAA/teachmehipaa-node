// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { EventType } from "./event-type.js";

export interface WebhookSubscriptionCreate {
  /** The HTTPS URL to deliver events to. */
  readonly endpointUrl: string;
  /** The event types to deliver. */
  readonly eventTypes: readonly EventType[];
  /** A description for your own reference. */
  readonly description?: string;
  /** Send `seats.low` when available seats drop to this number. Defaults to 5. */
  readonly seatsLowThreshold?: number;
}
