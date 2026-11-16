// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { EnrollmentCancelRefundedEffectiveStatus } from "./enrollment-cancel-refunded-effective-status.js";
import type { EnrollmentCancelRefundedRefund } from "./enrollment-cancel-refunded-refund.js";
import type { EnrollmentCancelRefundedStatus } from "./enrollment-cancel-refunded-status.js";

export interface EnrollmentCancelRefunded {
  readonly enrollmentId: string;
  readonly subjectId: string;
  readonly courseId: string;
  readonly orgId: string;
  readonly status: EnrollmentCancelRefundedStatus;
  readonly effectiveStatus: EnrollmentCancelRefundedEffectiveStatus;
  readonly archived: boolean;
  readonly cycle: number;
  readonly rev: number;
  readonly invitedAt: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly certifiedAt: string | null;
  readonly expiresAt: string | null;
  readonly certificateId: string | null;
  readonly refund: EnrollmentCancelRefundedRefund;
}
