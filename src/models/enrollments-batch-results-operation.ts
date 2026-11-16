// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/**
 * The operation that was run.
 *
 * Known values are listed; the API may add more at any time, so handle values you don't recognize.
 */
export type EnrollmentsBatchResultsOperation =
  | "remind"
  | "resendInvite"
  | "cancel"
  | "recertify"
  | "archive"
  | "unarchive"
  | (string & {});
