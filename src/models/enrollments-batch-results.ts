// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { EnrollmentsBatchResultsOperation } from "./enrollments-batch-results-operation.js";
import type { EnrollmentsBatchResultsResultsItem } from "./enrollments-batch-results-results-item.js";

export interface EnrollmentsBatchResults {
  /** The operation that was run. */
  readonly operation: EnrollmentsBatchResultsOperation;
  /** One result per enrollment: `succeeded`, `skipped` or `failed` with a problem. */
  readonly results: readonly EnrollmentsBatchResultsResultsItem[];
}
