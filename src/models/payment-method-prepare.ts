// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

export interface PaymentMethodPrepare {
  /** The Stripe SetupIntent. */
  readonly setupIntentId: string;
  /** Confirm the SetupIntent with Stripe.js using this secret. */
  readonly clientSecret: string;
  /** The Stripe publishable key to load Stripe.js with. */
  readonly publishableKey: string;
}
