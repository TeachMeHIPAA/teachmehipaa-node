// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { LearnerCertificate } from "./learner-certificate.js";
import type { LearnerCourse } from "./learner-course.js";
import type { LearnerStatus } from "./learner-status.js";

export interface Learner {
  /** Unique identifier for the learner. The same as the member's `subjectId`. */
  readonly learnerId: string;
  /** The learner's email address. */
  readonly email: string;
  /** The learner's full name. */
  readonly name: string | null;
  /** Your own id for the learner, unique within the organization. */
  readonly externalId: string | null;
  /** The learner's training status in this course. One of `not_started` (invited), `invite_bounced`, `in_progress`, `compliant`, `expiring_soon` (within 60 days of expiry), `expired` or `removed`. */
  readonly status: LearnerStatus;
  /** The course this learner record is for. */
  readonly course: LearnerCourse;
  /** When the learner was invited (ISO 8601). */
  readonly invitedAt: string | null;
  /**
   * When the learner started training.
   *
   * An ISO 8601 date-time string.
   */
  readonly startedAt: string | null;
  /**
   * When the learner completed the course.
   *
   * An ISO 8601 date-time string.
   */
  readonly completedAt: string | null;
  /**
   * When the learner's training is due.
   *
   * An ISO 8601 date-time string.
   */
  readonly dueAt: string | null;
  /** The learner's current certificate, with its verification and PDF links. */
  readonly certificate: LearnerCertificate | null;
}
