// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { SeatOrderEventDataStatus } from "./seat-order-event-data-status.js";

export interface SeatOrderEventData {
  readonly seatOrderId: string;
  readonly quantity: number;
  readonly status: SeatOrderEventDataStatus;
}
