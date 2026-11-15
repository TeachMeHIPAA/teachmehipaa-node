// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { EventType } from "./event-type.js";

export interface WebhookSubscriptionCreated {
  /** Unique identifier for the subscription. */
  readonly subscriptionId: string;
  /** The HTTPS URL events are delivered to. */
  readonly endpointUrl: string;
  /** The event types delivered. */
  readonly eventTypes: readonly EventType[];
  /** Whether deliveries are on. */
  readonly enabled: boolean;
  readonly description: string | null;
  readonly seatsLowThreshold: number;
  /** Identifies the signing secret. */
  readonly secretKeyId: string;
  /** An ISO 8601 date-time string. */
  readonly createdAt: string;
  readonly rev: number;
  /** The signing secret. Returned only once: store it now. */
  readonly secret: string;
}
