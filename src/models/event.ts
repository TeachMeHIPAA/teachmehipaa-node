// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { EventCertificateRevoked } from "./event-certificate-revoked.js";
import type { EventEnrollmentCertified } from "./event-enrollment-certified.js";
import type { EventInviteBounced } from "./event-invite-bounced.js";
import type { EventLearnerCertified } from "./event-learner-certified.js";
import type { EventLearnerExpired } from "./event-learner-expired.js";
import type { EventLearnerExpiring } from "./event-learner-expiring.js";
import type { EventLearnerInvited } from "./event-learner-invited.js";
import type { EventLearnerRemoved } from "./event-learner-removed.js";
import type { EventLearnerStarted } from "./event-learner-started.js";
import type { EventSeatConsumed } from "./event-seat-consumed.js";
import type { EventSeatFreed } from "./event-seat-freed.js";
import type { EventSeatOrderExpired } from "./event-seat-order-expired.js";
import type { EventSeatOrderFailed } from "./event-seat-order-failed.js";
import type { EventSeatOrderPaid } from "./event-seat-order-paid.js";
import type { EventSeatsLow } from "./event-seats-low.js";

/** Tell the variants apart by `eventType`. New variants may be added; handle values you don't recognize. */
export type Event =
  | EventCertificateRevoked
  | EventEnrollmentCertified
  | EventInviteBounced
  | EventLearnerCertified
  | EventLearnerExpired
  | EventLearnerExpiring
  | EventLearnerInvited
  | EventLearnerRemoved
  | EventLearnerStarted
  | EventSeatConsumed
  | EventSeatFreed
  | EventSeatOrderExpired
  | EventSeatOrderFailed
  | EventSeatOrderPaid
  | EventSeatsLow;
