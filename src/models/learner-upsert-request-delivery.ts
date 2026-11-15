// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/**
 * `email` (default) sends the invite email. `none` sends nothing and returns `joinUrl` for you to deliver.
 *
 * Known values are listed; the API may add more at any time, so handle values you don't recognize.
 */
export type LearnerUpsertRequestDelivery = "email" | "none" | (string & {});
