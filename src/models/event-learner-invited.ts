// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { LearnerEventData } from "./learner-event-data.js";

export interface EventLearnerInvited {
  readonly eventId: string;
  readonly eventType: "learner.invited";
  readonly orgId: string;
  /** An ISO 8601 date-time string. */
  readonly occurredAt: string;
  readonly data: LearnerEventData;
}
