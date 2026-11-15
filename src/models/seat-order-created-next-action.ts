// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { SeatOrderCreatedNextActionInvoice } from "./seat-order-created-next-action-invoice.js";
import type { SeatOrderCreatedNextActionRedirect } from "./seat-order-created-next-action-redirect.js";

/**
 * Where to send the buyer next: a checkout `url` to redirect to, or a hosted invoice.
 *
 * Tell the variants apart by `type`. New variants may be added; handle values you don't recognize.
 */
export type SeatOrderCreatedNextAction =
  SeatOrderCreatedNextActionInvoice | SeatOrderCreatedNextActionRedirect;
