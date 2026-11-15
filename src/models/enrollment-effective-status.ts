// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/**
 * The status to display. Adds `EXPIRING`, `EXPIRED` and `ARCHIVED`, derived when you read it.
 *
 * Known values are listed; the API may add more at any time, so handle values you don't recognize.
 */
export type EnrollmentEffectiveStatus =
  | "INVITED"
  | "EMAIL_BOUNCED"
  | "STARTED"
  | "ASSESSMENT_IN_PROGRESS"
  | "CERTIFIED"
  | "CANCELLED"
  | "EXPIRING"
  | "EXPIRED"
  | "ARCHIVED"
  | (string & {});
