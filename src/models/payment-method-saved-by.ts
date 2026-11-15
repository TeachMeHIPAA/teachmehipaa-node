// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { PaymentMethodSavedByApiClient } from "./payment-method-saved-by-api-client.js";
import type { PaymentMethodSavedByUser } from "./payment-method-saved-by-user.js";

/** Tell the variants apart by `type`. New variants may be added; handle values you don't recognize. */
export type PaymentMethodSavedBy =
  PaymentMethodSavedByApiClient | PaymentMethodSavedByUser;
