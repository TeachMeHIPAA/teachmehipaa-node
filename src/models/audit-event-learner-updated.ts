// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActor } from "./audit-event-actor.js";
import type { AuditEventLearnerUpdatedFieldsItem } from "./audit-event-learner-updated-fields-item.js";

export interface AuditEventLearnerUpdated {
  readonly eventId: string;
  readonly at: string;
  readonly type: "learner.updated";
  readonly actorSubjectId: string;
  readonly actor: AuditEventActor;
  readonly subjectId: string;
  readonly fields: readonly AuditEventLearnerUpdatedFieldsItem[];
}
