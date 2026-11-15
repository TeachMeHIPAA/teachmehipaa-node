// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { LearnerRemindAcceptedAction } from "./learner-remind-accepted-action.js";

export interface LearnerRemindAccepted {
  /** The learner the reminder is for. */
  readonly learnerId: string;
  /** Always `remind`. */
  readonly action: LearnerRemindAcceptedAction;
}
