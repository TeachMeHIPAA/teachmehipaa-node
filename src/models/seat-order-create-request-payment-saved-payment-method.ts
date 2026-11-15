// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

export interface SeatOrderCreateRequestPaymentSavedPaymentMethod {
  readonly method: "saved_payment_method";
  readonly returnUrl?: string;
  readonly paymentMethodId?: string;
  readonly expectedTotal?: number;
  readonly currency?: string;
}
