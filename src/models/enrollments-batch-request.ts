// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { EnrollmentsBatchRequestOperation } from "./enrollments-batch-request-operation.js";
import type { EnrollmentsBatchRequestSelect } from "./enrollments-batch-request-select.js";

export interface EnrollmentsBatchRequest {
  /** What to do to each enrollment: `remind`, `resendInvite`, `cancel`, `recertify`, `archive` or `unarchive`. */
  readonly operation: EnrollmentsBatchRequestOperation;
  /** The enrollments to act on: a list of `enrollmentIds` (up to 500), or a `filter`. */
  readonly select: EnrollmentsBatchRequestSelect;
}
