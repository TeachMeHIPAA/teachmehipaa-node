// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/**
 * Applies to every item. `email` (default) sends invites; `none` sends nothing.
 *
 * Known values are listed; the API may add more at any time, so handle values you don't recognize.
 */
export type LearnerBatchUpsertRequestDelivery =
  "email" | "none" | (string & {});
