// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

export interface PaymentMethodSetupRequest {
  /** Where Stripe sends the buyer afterwards. Must be https and on your client's allowlist. */
  readonly returnUrl: string;
}
