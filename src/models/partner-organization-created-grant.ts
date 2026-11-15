// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { PartnerOrganizationCreatedGrantScopesItem } from "./partner-organization-created-grant-scopes-item.js";

/** Your app's connection to the organization. */
export interface PartnerOrganizationCreatedGrant {
  readonly grantId: string;
  readonly scopes: readonly PartnerOrganizationCreatedGrantScopesItem[];
}
