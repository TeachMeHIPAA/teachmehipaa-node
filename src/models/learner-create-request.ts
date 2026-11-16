// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { LearnerCreateRequestDelivery } from "./learner-create-request-delivery.js";
import type { LearnerCreateRequestSeatPolicy } from "./learner-create-request-seat-policy.js";

export interface LearnerCreateRequest {
  /** The learner's email address. */
  readonly email: string;
  /** The learner's full name. */
  readonly name?: string;
  /** Your own id for the learner, unique within the organization. */
  readonly externalId?: string;
  /** The course to invite them to. Defaults to the organization's default course. */
  readonly courseId?: string;
  /** `email` (default) sends the invite email. `none` sends nothing and returns `joinUrl` for you to deliver. */
  readonly delivery?: LearnerCreateRequestDelivery;
  /** `require_available` fails with `409` when no seat is free. */
  readonly seatPolicy?: LearnerCreateRequestSeatPolicy;
}
