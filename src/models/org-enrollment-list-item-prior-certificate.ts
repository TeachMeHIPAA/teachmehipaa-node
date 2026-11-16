// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { OrgEnrollmentListItemPriorCertificateStatus } from "./org-enrollment-list-item-prior-certificate-status.js";

export interface OrgEnrollmentListItemPriorCertificate {
  readonly certificateId: string;
  readonly issuedAt: string | null;
  readonly expiresAt: string | null;
  readonly status: OrgEnrollmentListItemPriorCertificateStatus;
}
