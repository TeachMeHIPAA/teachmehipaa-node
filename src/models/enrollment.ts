// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { EnrollmentEffectiveStatus } from "./enrollment-effective-status.js";
import type { EnrollmentStatus } from "./enrollment-status.js";

export interface Enrollment {
  /** Unique identifier for the enrollment. */
  readonly enrollmentId: string;
  /** The learner's member id. */
  readonly subjectId: string;
  /** The course. */
  readonly courseId: string;
  /** The organization's id. */
  readonly orgId: string;
  /** The stored lifecycle state: `INVITED`, `EMAIL_BOUNCED`, `STARTED`, `ASSESSMENT_IN_PROGRESS`, `CERTIFIED` or `CANCELLED`. */
  readonly status: EnrollmentStatus;
  /** The status to display. Adds `EXPIRING`, `EXPIRED` and `ARCHIVED`, derived when you read it. */
  readonly effectiveStatus: EnrollmentEffectiveStatus;
  /** Whether the enrollment is archived. */
  readonly archived: boolean;
  /** The certification cycle, starting at 0. Renewing adds one. */
  readonly cycle: number;
  /** The resource's revision. Its strong `ETag` is derived from it. */
  readonly rev: number;
  /** When the learner was invited (ISO 8601). */
  readonly invitedAt: string | null;
  /** When the learner started. */
  readonly startedAt: string | null;
  /** When the learner completed the course. */
  readonly completedAt: string | null;
  /** When the learner was certified. */
  readonly certifiedAt: string | null;
  /** When the certification expires. */
  readonly expiresAt: string | null;
  /** The certificate issued for this cycle, if any. */
  readonly certificateId: string | null;
}
