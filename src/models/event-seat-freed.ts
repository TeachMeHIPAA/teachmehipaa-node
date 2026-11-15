// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

export interface EventSeatFreed {
  readonly eventId: string;
  readonly eventType: "seat.freed";
  readonly orgId: string;
  /** An ISO 8601 date-time string. */
  readonly occurredAt: string;
  readonly data: Readonly<Record<string, unknown>>;
}
