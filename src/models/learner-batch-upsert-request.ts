// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { LearnerBatchUpsertRequestDelivery } from "./learner-batch-upsert-request-delivery.js";
import type { LearnerBatchUpsertRequestItemsItem } from "./learner-batch-upsert-request-items-item.js";
import type { LearnerBatchUpsertRequestSeatPolicy } from "./learner-batch-upsert-request-seat-policy.js";

export interface LearnerBatchUpsertRequest {
  /** Up to 500 learners, each with the same fields as creating one learner. */
  readonly items: readonly LearnerBatchUpsertRequestItemsItem[];
  /** Applies to every item. `email` (default) sends invites; `none` sends nothing. */
  readonly delivery?: LearnerBatchUpsertRequestDelivery;
  /** Applies to every item. `require_available` fails an item when no seat is free. */
  readonly seatPolicy?: LearnerBatchUpsertRequestSeatPolicy;
}
