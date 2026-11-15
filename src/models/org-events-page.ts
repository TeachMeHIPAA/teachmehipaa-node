// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { Event } from "./event.js";

export interface OrgEventsPage {
  readonly items: readonly Event[];
  readonly nextCursor: string | null;
}
