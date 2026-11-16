// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { OrgEnrollmentListItem } from "./org-enrollment-list-item.js";

export interface EnrollmentsListPage {
  readonly items: readonly OrgEnrollmentListItem[];
  readonly nextCursor: string | null;
}
