// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/**
 * The stored lifecycle state: `INVITED`, `EMAIL_BOUNCED`, `STARTED`, `ASSESSMENT_IN_PROGRESS`, `CERTIFIED` or `CANCELLED`.
 *
 * Known values are listed; the API may add more at any time, so handle values you don't recognize.
 */
export type EnrollmentStatus =
  | "INVITED"
  | "EMAIL_BOUNCED"
  | "STARTED"
  | "ASSESSMENT_IN_PROGRESS"
  | "CERTIFIED"
  | "CANCELLED"
  | (string & {});
