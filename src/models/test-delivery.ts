// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/** The body of a :test delivery. It is not an event envelope; its x-tmh-event-id is a UUID. */
export interface TestDelivery {
  /** The subscription that was tested. */
  readonly subscriptionId: string;
  /** Always true. */
  readonly test: boolean;
}
