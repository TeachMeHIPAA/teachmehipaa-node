// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { EnrollmentsBatchRequestSelectEnrollmentIds } from "./enrollments-batch-request-select-enrollment-ids.js";
import type { EnrollmentsBatchRequestSelectFilter } from "./enrollments-batch-request-select-filter.js";

/** The enrollments to act on: a list of `enrollmentIds` (up to 500), or a `filter`. */
export type EnrollmentsBatchRequestSelect =
  | EnrollmentsBatchRequestSelectEnrollmentIds
  | EnrollmentsBatchRequestSelectFilter;
