// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { WebhookSubscription } from "./webhook-subscription.js";

export interface WebhookSubscriptionsPage {
  readonly items: readonly WebhookSubscription[];
  readonly nextCursor: string | null;
}
