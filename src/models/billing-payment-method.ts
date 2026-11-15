// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { BillingPaymentMethodDefaultPaymentMethod } from "./billing-payment-method-default-payment-method.js";

export interface BillingPaymentMethod {
  /** The saved card's brand, last four digits, expiry and id, or `null` when none is saved. */
  readonly defaultPaymentMethod: BillingPaymentMethodDefaultPaymentMethod | null;
  /** Whether a `saved_payment_method` order would charge it now. */
  readonly chargeable: boolean;
}
