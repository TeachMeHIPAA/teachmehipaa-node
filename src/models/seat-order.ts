// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { SeatOrderFailure } from "./seat-order-failure.js";
import type { SeatOrderPaymentMethod } from "./seat-order-payment-method.js";
import type { SeatOrderStatus } from "./seat-order-status.js";

export interface SeatOrder {
  /** Unique identifier for the seat order. */
  readonly seatOrderId: string;
  /** The organization's id. */
  readonly orgId: string;
  /** Seats ordered. */
  readonly quantity: number;
  /** Price per seat, in the currency's smallest unit. */
  readonly unitAmount: number;
  /** Three-letter ISO currency code, lowercase. */
  readonly currency: string;
  /** The order total, in the currency's smallest unit. */
  readonly total: number;
  /** `hosted_checkout`, `saved_payment_method` or `invoice`. */
  readonly paymentMethod: SeatOrderPaymentMethod;
  /** `requires_action`, `processing`, `invoiced`, `paid`, `failed`, `expired` or `refunded`. */
  readonly status: SeatOrderStatus;
  /** Seats granted so far. */
  readonly seatsGranted: number;
  /** Seats refunded through support. */
  readonly seatsRefunded: number;
  /** Why the order failed, with Stripe's decline code when there is one. */
  readonly failure: SeatOrderFailure | null;
  /** The API client that placed the order, if one did. */
  readonly clientId: string | null;
  /** Your own reference for the order. */
  readonly clientReference: string | null;
  /** The Stripe checkout session, for a hosted checkout. */
  readonly checkoutId: string | null;
  /** When it was created (ISO 8601). */
  readonly createdAt: string;
  /**
   * When it last changed.
   *
   * An ISO 8601 date-time string.
   */
  readonly updatedAt: string;
  /** The resource's revision. Its strong `ETag` is derived from it. */
  readonly rev: number;
}
