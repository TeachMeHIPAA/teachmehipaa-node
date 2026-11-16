// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventActor } from "./audit-event-actor.js";

export interface AuditEventLearnerLaunchLinkCreated {
  readonly eventId: string;
  readonly at: string;
  readonly type: "learner.launch_link_created";
  readonly actorSubjectId: string;
  readonly actor: AuditEventActor;
  readonly subjectId: string;
  readonly courseId: string;
}
