// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/**
 * Whether the holder could be resolved: `resolved`, `none` or `lookup_failed`.
 *
 * Known values are listed; the API may add more at any time, so handle values you don't recognize.
 */
export type CertificateHolderStatus =
  "resolved" | "none" | "lookup_failed" | (string & {});
