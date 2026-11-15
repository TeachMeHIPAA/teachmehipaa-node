// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { EnrollmentActionAcceptedAction } from "./enrollment-action-accepted-action.js";

export interface EnrollmentActionAccepted {
  /** The enrollment the request is for. */
  readonly enrollmentId: string;
  /** The action that was accepted: `remind` or `resendInvite`. */
  readonly action: EnrollmentActionAcceptedAction;
}
