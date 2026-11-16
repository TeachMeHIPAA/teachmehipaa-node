// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEvent } from "./audit-event.js";

export interface AuditEventsPage {
  readonly items: readonly AuditEvent[];
  readonly nextCursor: string | null;
}
