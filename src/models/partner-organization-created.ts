// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { PartnerOrganizationCreatedGrant } from "./partner-organization-created-grant.js";

export interface PartnerOrganizationCreated {
  /** The new organization's id. */
  readonly orgId: string;
  /** The organization's name. */
  readonly name: string;
  /** When it was created (ISO 8601). */
  readonly createdAt: string;
  /** Your app's connection to the organization. */
  readonly grant: PartnerOrganizationCreatedGrant;
  /** Returned only once. Exchange it at `POST /v1/auth/token` for the organization's tokens. */
  readonly refresh_token: string;
}
