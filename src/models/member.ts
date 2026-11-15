// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { MemberRole } from "./member-role.js";

export interface Member {
  /** Unique identifier for the member. `null` for an older member who can't be addressed yet. */
  readonly subjectId: string | null;
  /** The member's email address. */
  readonly email: string;
  /** The member's full name. */
  readonly name: string | null;
  /** `admin` or `learner`. */
  readonly role: MemberRole;
  /** Whether the member's account is disabled. */
  readonly isDisabled: boolean;
}
