// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { EventType } from "./event-type.js";

export interface WebhookSubscription {
  /** Unique identifier for the subscription. */
  readonly subscriptionId: string;
  /** The HTTPS URL events are delivered to. */
  readonly endpointUrl: string;
  /** The event types delivered. */
  readonly eventTypes: readonly EventType[];
  /** Whether deliveries are on. */
  readonly enabled: boolean;
  /** Your description of the subscription. */
  readonly description: string | null;
  /** Send `seats.low` when available seats drop to this number. Defaults to 5. */
  readonly seatsLowThreshold: number;
  /** Identifies the signing secret. Sent as `x-tmh-key-id`. */
  readonly secretKeyId: string;
  /** When it was created (ISO 8601). */
  readonly createdAt: string;
  /** The resource's revision. Its strong `ETag` is derived from it. */
  readonly rev: number;
}
