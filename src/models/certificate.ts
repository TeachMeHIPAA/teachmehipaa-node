// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { CertificateHolderStatus } from "./certificate-holder-status.js";
import type { CertificateStatus } from "./certificate-status.js";

export interface Certificate {
  /** Unique identifier for the certificate. */
  readonly certificateId: string;
  /** The holder's member id. */
  readonly subjectId: string | null;
  /** Whether the holder could be resolved: `resolved`, `none` or `lookup_failed`. */
  readonly holderStatus?: CertificateHolderStatus;
  /** The course the certificate is for. */
  readonly courseId: string;
  /** The course version the holder passed. */
  readonly courseVersion: string | null;
  /** When it was issued (ISO 8601). */
  readonly issuedAt: string | null;
  /** When it expires. */
  readonly expiresAt: string | null;
  /** `VALID`, `EXPIRED` or `REVOKED`. */
  readonly status: CertificateStatus;
  /** When it was revoked, if it was. */
  readonly revokedAt: string | null;
}
