// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/** Learners by status: `learners`, `compliant`, `expiringSoon`, `expired`, `inProgress`, `notStarted` and `inviteBounced`. */
export interface ComplianceSummaryTotals {
  readonly learners: number;
  readonly compliant: number;
  readonly expiringSoon: number;
  readonly expired: number;
  readonly inProgress: number;
  readonly notStarted: number;
  readonly inviteBounced: number;
}
