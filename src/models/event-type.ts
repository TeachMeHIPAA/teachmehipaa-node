// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/** Known values are listed; the API may add more at any time, so handle values you don't recognize. */
export type EventType =
  | "enrollment.certified"
  | "seat.consumed"
  | "seat.freed"
  | "learner.invited"
  | "learner.started"
  | "learner.certified"
  | "learner.expiring"
  | "learner.expired"
  | "learner.removed"
  | "invite.bounced"
  | "certificate.revoked"
  | "seats.low"
  | "seat_order.paid"
  | "seat_order.failed"
  | "seat_order.expired"
  | (string & {});
