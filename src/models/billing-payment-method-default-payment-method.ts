// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { PaymentMethodSavedBy } from "./payment-method-saved-by.js";

export interface BillingPaymentMethodDefaultPaymentMethod {
  readonly brand: string;
  readonly last4: string;
  readonly expMonth: number;
  readonly expYear: number;
  readonly paymentMethodId: string | null;
  readonly savedBy: PaymentMethodSavedBy | null;
  /** An ISO 8601 date-time string. */
  readonly savedAt: string | null;
  readonly expired: boolean;
}
