// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { LearnerCreatedCertificate } from "./learner-created-certificate.js";
import type { LearnerCreatedCourse } from "./learner-created-course.js";
import type { LearnerCreatedDelivery } from "./learner-created-delivery.js";
import type { LearnerStatus } from "./learner-status.js";

export interface LearnerCreated {
  /** Unique identifier for the learner. */
  readonly learnerId: string;
  /** The learner's email address. */
  readonly email: string;
  /** The learner's full name. */
  readonly name: string | null;
  /** Your own id for the learner. */
  readonly externalId: string | null;
  /** The learner's training status. One of `not_started` (invited), `invite_bounced`, `in_progress`, `compliant`, `expiring_soon` (within 60 days of expiry), `expired` or `removed`. */
  readonly status: LearnerStatus;
  /** The course the learner was invited to. */
  readonly course: LearnerCreatedCourse;
  /** An ISO 8601 date-time string. */
  readonly invitedAt: string | null;
  /** An ISO 8601 date-time string. */
  readonly startedAt: string | null;
  /** An ISO 8601 date-time string. */
  readonly completedAt: string | null;
  /** An ISO 8601 date-time string. */
  readonly dueAt: string | null;
  readonly certificate: LearnerCreatedCertificate | null;
  /** How the invite was delivered: `email`, or `none` when you deliver it. */
  readonly delivery?: LearnerCreatedDelivery;
  /** The invite link, returned once when `delivery` is `none`. Send it to the learner yourself. */
  readonly joinUrl?: string;
}
