// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { EnrollmentCertifiedEventData } from "./enrollment-certified-event-data.js";

export interface EventEnrollmentCertified {
  readonly eventId: string;
  readonly eventType: "enrollment.certified";
  readonly orgId: string;
  /** An ISO 8601 date-time string. */
  readonly occurredAt: string;
  readonly data: EnrollmentCertifiedEventData;
}
