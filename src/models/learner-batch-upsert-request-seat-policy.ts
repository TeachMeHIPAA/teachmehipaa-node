// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/**
 * Applies to every item. `require_available` fails an item when no seat is free.
 *
 * Known values are listed; the API may add more at any time, so handle values you don't recognize.
 */
export type LearnerBatchUpsertRequestSeatPolicy =
  "require_available" | (string & {});
