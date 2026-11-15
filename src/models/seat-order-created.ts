// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { SeatOrderCreatedFailure } from "./seat-order-created-failure.js";
import type { SeatOrderCreatedNextAction } from "./seat-order-created-next-action.js";
import type { SeatOrderCreatedStatus } from "./seat-order-created-status.js";

export interface SeatOrderCreated {
  /** Unique identifier for the seat order. */
  readonly seatOrderId: string;
  /** The order's status. */
  readonly status: SeatOrderCreatedStatus;
  /** Where to send the buyer next: a checkout `url` to redirect to, or a hosted invoice. */
  readonly nextAction: SeatOrderCreatedNextAction | null;
  /** Why the payment failed, if it did. */
  readonly failure: SeatOrderCreatedFailure | null;
}
