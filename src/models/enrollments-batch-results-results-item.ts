// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { EnrollmentsBatchResultsResultsItemOutcome } from "./enrollments-batch-results-results-item-outcome.js";
import type { Problem } from "./problem.js";

export interface EnrollmentsBatchResultsResultsItem {
  readonly enrollmentId: string;
  readonly outcome: EnrollmentsBatchResultsResultsItemOutcome;
  readonly problem?: Problem;
}
