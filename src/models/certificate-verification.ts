// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { CertificateVerificationIssuer } from "./certificate-verification-issuer.js";
import type { CertificateVerificationStatus } from "./certificate-verification-status.js";

export interface CertificateVerification {
  /** `valid`, `expired` or `revoked`. */
  readonly status: CertificateVerificationStatus;
  /** The name printed on the certificate. */
  readonly learnerName: string;
  /** The course. */
  readonly courseTitle: string;
  /** When it was issued (ISO 8601). */
  readonly issuedAt: string;
  /**
   * When it expires.
   *
   * An ISO 8601 date-time string.
   */
  readonly expiresAt: string;
  /** Who issued it. */
  readonly issuer: CertificateVerificationIssuer;
}
