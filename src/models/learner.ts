/**
 * A Learner's training status. Known values are listed; new ones may appear
 * without notice (ADR-0006).
 */
export type LearnerStatus =
  | "not_started"
  | "invite_bounced"
  | "in_progress"
  | "compliant"
  | "expiring_soon"
  | "expired"
  | "removed"
  | (string & {});

export interface LearnerCourse {
  readonly courseId: string;
  readonly title: string;
}

export interface LearnerCertificate {
  readonly certificateId: string;
  /** ISO 8601. */
  readonly issuedAt: string;
  /** ISO 8601. */
  readonly expiresAt: string;
  readonly verifyUrl: string | null;
  readonly pdfUrl: string;
}

/** A Member taking a Course, seen from the Organization's side. */
export interface Learner {
  /** The Learner's id, the same as the Member's `subjectId` (`sub_…`). */
  readonly learnerId: string;
  readonly email: string;
  readonly name: string | null;
  /** Your own id for the Learner, unique within the Organization. */
  readonly externalId: string | null;
  /** The Learner's training status in this Course. */
  readonly status: LearnerStatus;
  /** The Course this Learner record is for. */
  readonly course: LearnerCourse;
  /** ISO 8601. */
  readonly invitedAt: string | null;
  /** ISO 8601. */
  readonly startedAt: string | null;
  /** ISO 8601. */
  readonly completedAt: string | null;
  /** ISO 8601. */
  readonly dueAt: string | null;
  /** The Learner's current Certificate, with its verification and PDF links. */
  readonly certificate: LearnerCertificate | null;
}

/** A one-time URL that signs a Learner straight into their Training. */
export interface LearnerLaunchLink {
  /** Single-use; redirect the Learner to it right away. */
  readonly url: string;
  /** ISO 8601; 5 minutes after it was created. */
  readonly expiresAt: string;
}
