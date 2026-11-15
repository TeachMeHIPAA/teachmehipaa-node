// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { SeatOrder } from "./seat-order.js";

export interface SeatOrdersPage {
  readonly items: readonly SeatOrder[];
  readonly nextCursor: string | null;
}
