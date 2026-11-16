// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventEnrollmentTransitionStatusFrom } from "./audit-event-enrollment-transition-status-from.js";
import type { AuditEventEnrollmentTransitionStatusTo } from "./audit-event-enrollment-transition-status-to.js";
import type { AuditEventEnrollmentTransitionTransition } from "./audit-event-enrollment-transition-transition.js";

export interface AuditEventEnrollmentTransition {
  readonly eventId: string;
  readonly at: string;
  readonly type: "enrollment.transition";
  readonly transition: AuditEventEnrollmentTransitionTransition;
  readonly subjectId: string;
  readonly courseId: string;
  readonly statusFrom: AuditEventEnrollmentTransitionStatusFrom;
  readonly statusTo: AuditEventEnrollmentTransitionStatusTo;
  readonly archivedFrom: boolean;
  readonly archivedTo: boolean;
  readonly rev: number;
}
