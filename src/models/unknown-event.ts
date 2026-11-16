// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/** An event whose eventType is not in the catalog yet. The catalog only grows, so SDKs parse it instead of failing. */
export interface UnknownEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly orgId: string;
  /** An ISO 8601 date-time string. */
  readonly occurredAt: string;
  readonly data: Readonly<Record<string, unknown>>;
}
