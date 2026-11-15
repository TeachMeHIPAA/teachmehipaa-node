// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { SeatOrderCreateRequestPaymentHostedCheckout } from "./seat-order-create-request-payment-hosted-checkout.js";
import type { SeatOrderCreateRequestPaymentInvoice } from "./seat-order-create-request-payment-invoice.js";
import type { SeatOrderCreateRequestPaymentSavedPaymentMethod } from "./seat-order-create-request-payment-saved-payment-method.js";

/**
 * How to pay: `hosted_checkout` with a `returnUrl`, `saved_payment_method` with the card's `paymentMethodId`, or `invoice`. A `returnUrl` must be https and on your API client's allowlist.
 *
 * Tell the variants apart by `method`. New variants may be added; handle values you don't recognize.
 */
export type SeatOrderCreateRequestPayment =
  | SeatOrderCreateRequestPaymentHostedCheckout
  | SeatOrderCreateRequestPaymentInvoice
  | SeatOrderCreateRequestPaymentSavedPaymentMethod;
