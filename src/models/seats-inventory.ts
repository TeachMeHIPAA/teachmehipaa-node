// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { SeatsInventoryByState } from "./seats-inventory-by-state.js";

export interface SeatsInventory {
  /** All seats on record. */
  readonly total: number;
  /** Seats in use. */
  readonly used: number;
  /** Seats a new invite can use now. */
  readonly available: number;
  /** Seats the organization holds and hasn't been refunded for, including a trial seat. */
  readonly purchased?: number;
  /** Seats held by an invited or enrolled learner. */
  readonly assigned?: number;
  /** Seats by internal state. Prefer `purchased`, `assigned` and `available`. */
  readonly byState: SeatsInventoryByState;
}
