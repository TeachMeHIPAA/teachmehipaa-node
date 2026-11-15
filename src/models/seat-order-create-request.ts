// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { SeatOrderCreateRequestPayment } from "./seat-order-create-request-payment.js";

export interface SeatOrderCreateRequest {
  /** Seats to buy. */
  readonly quantity: number;
  /** How to pay: `hosted_checkout` with a `returnUrl`, `saved_payment_method` with the card's `paymentMethodId`, or `invoice`. A `returnUrl` must be https and on your API client's allowlist. */
  readonly payment: SeatOrderCreateRequestPayment;
  /** Your own reference for the order. */
  readonly clientReference?: string;
}
