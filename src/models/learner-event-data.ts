// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { LearnerStatus } from "./learner-status.js";

export interface LearnerEventData {
  readonly learnerId: string;
  readonly email: string;
  readonly externalId: string | null;
  readonly courseId: string;
  readonly status: LearnerStatus;
  /** An ISO 8601 date-time string. */
  readonly occurredAt: string;
}
