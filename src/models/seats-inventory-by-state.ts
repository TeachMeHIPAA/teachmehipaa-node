// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/** Seats by internal state. Prefer `purchased`, `assigned` and `available`. */
export interface SeatsInventoryByState {
  readonly UNUSED: number;
  readonly ASSIGNED: number;
  readonly ACCEPTED: number;
  readonly REVOKED: number;
  readonly FREE: number;
  readonly REFUNDED: number;
}
