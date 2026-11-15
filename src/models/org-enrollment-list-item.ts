// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { OrgEnrollmentListItemEffectiveStatus } from "./org-enrollment-list-item-effective-status.js";
import type { OrgEnrollmentListItemPriorCertificate } from "./org-enrollment-list-item-prior-certificate.js";
import type { OrgEnrollmentListItemStatus } from "./org-enrollment-list-item-status.js";

export interface OrgEnrollmentListItem {
  readonly enrollmentId: string;
  readonly subjectId: string;
  readonly courseId: string;
  readonly orgId: string;
  readonly status: OrgEnrollmentListItemStatus;
  readonly effectiveStatus: OrgEnrollmentListItemEffectiveStatus;
  readonly archived: boolean;
  readonly cycle: number;
  readonly rev: number;
  readonly invitedAt: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly certifiedAt: string | null;
  readonly expiresAt: string | null;
  readonly certificateId: string | null;
  readonly priorCertificate?: OrgEnrollmentListItemPriorCertificate | null;
}
