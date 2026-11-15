// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/**
 * The order's status.
 *
 * Known values are listed; the API may add more at any time, so handle values you don't recognize.
 */
export type SeatOrderCreatedStatus =
  | "requires_action"
  | "processing"
  | "invoiced"
  | "paid"
  | "failed"
  | "expired"
  | "refunded"
  | (string & {});
