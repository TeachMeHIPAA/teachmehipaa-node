// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

export interface SeatOrderQuote {
  /** Seats quoted. */
  readonly quantity: number;
  /** Price per seat, in the currency's smallest unit. */
  readonly unitAmount: number;
  /** Three-letter ISO currency code, lowercase. */
  readonly currency: string;
  /** Price before tax. */
  readonly subtotal: number;
  /** Always `null`: tax is calculated at payment. */
  readonly tax: unknown;
  /** The quoted total. */
  readonly total: number;
  /**
   * When the quote expires, 15 minutes after it was made.
   *
   * An ISO 8601 date-time string.
   */
  readonly quoteExpiresAt: string;
}
