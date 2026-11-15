// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { PartnerOrganization } from "./partner-organization.js";

export interface PartnerOrganizationsPage {
  readonly items: readonly PartnerOrganization[];
  readonly nextCursor: string | null;
}
