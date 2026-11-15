// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/**
 * `requires_action`, `processing`, `invoiced`, `paid`, `failed`, `expired` or `refunded`.
 *
 * Known values are listed; the API may add more at any time, so handle values you don't recognize.
 */
export type SeatOrderStatus =
  | "requires_action"
  | "processing"
  | "invoiced"
  | "paid"
  | "failed"
  | "expired"
  | "refunded"
  | (string & {});
