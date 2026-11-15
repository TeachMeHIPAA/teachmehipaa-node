// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/**
 * What to do to each enrollment: `remind`, `resendInvite`, `cancel`, `recertify`, `archive` or `unarchive`.
 *
 * Known values are listed; the API may add more at any time, so handle values you don't recognize.
 */
export type EnrollmentsBatchRequestOperation =
  | "remind"
  | "resendInvite"
  | "cancel"
  | "recertify"
  | "archive"
  | "unarchive"
  | (string & {});
