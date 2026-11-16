// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { MemberListItemRole } from "./member-list-item-role.js";

export interface MemberListItem {
  readonly subjectId: string | null;
  readonly email: string;
  readonly name: string | null;
  readonly role: MemberListItemRole;
  readonly isDisabled: boolean;
  readonly enrollmentSubjectId?: string | null;
  readonly holdsInvitation?: boolean;
}
