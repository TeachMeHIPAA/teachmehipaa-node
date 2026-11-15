// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { PartnerOrganizationCreateScopesItem } from "./partner-organization-create-scopes-item.js";

export interface PartnerOrganizationCreate {
  /** The organization's name. */
  readonly name: string;
  /** The email address of the organization's administrator. */
  readonly adminEmail: string;
  /** The administrator's full name. */
  readonly adminName?: string;
  /** The scopes your app gets on the new organization. A subset of your app's scopes. */
  readonly scopes: readonly PartnerOrganizationCreateScopesItem[];
}
