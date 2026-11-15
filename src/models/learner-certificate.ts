// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/** The learner's current certificate, with its verification and PDF links. */
export interface LearnerCertificate {
  readonly certificateId: string;
  /** An ISO 8601 date-time string. */
  readonly issuedAt: string;
  /** An ISO 8601 date-time string. */
  readonly expiresAt: string;
  readonly verifyUrl: string | null;
  readonly pdfUrl: string;
}
