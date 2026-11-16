// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { ComplianceSummaryTotals } from "./compliance-summary-totals.js";

export interface ComplianceSummary {
  /** When the counts were taken (ISO 8601). */
  readonly asOf: string;
  /** The course. */
  readonly courseId: string;
  /** Learners by status: `learners`, `compliant`, `expiringSoon`, `expired`, `inProgress`, `notStarted` and `inviteBounced`. */
  readonly totals: ComplianceSummaryTotals;
  /** `compliant` divided by `learners`, or 0 with no learners. */
  readonly compliantRate: number;
}
