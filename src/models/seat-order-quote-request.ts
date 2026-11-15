// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

export interface SeatOrderQuoteRequest {
  /** Seats to quote. */
  readonly quantity: number;
  /** The currency you expect to be charged in. It must match the organization's. */
  readonly currency?: string;
}
