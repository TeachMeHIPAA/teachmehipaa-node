// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { MemberListItem } from "./member-list-item.js";

export interface MembersPage {
  readonly items: readonly MemberListItem[];
  readonly nextCursor: string | null;
}
