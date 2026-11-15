// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { LearnerUpsertRequestDelivery } from "./learner-upsert-request-delivery.js";
import type { LearnerUpsertRequestSeatPolicy } from "./learner-upsert-request-seat-policy.js";

export interface LearnerUpsertRequest {
  /** The learner's email address. */
  readonly email: string;
  /** The learner's full name. */
  readonly name?: string;
  /** The course to invite them to. Defaults to the organization's default course. */
  readonly courseId?: string;
  /** `email` (default) sends the invite email. `none` sends nothing and returns `joinUrl` for you to deliver. */
  readonly delivery?: LearnerUpsertRequestDelivery;
  /** `require_available` fails with `409` when no seat is free. */
  readonly seatPolicy?: LearnerUpsertRequestSeatPolicy;
}
