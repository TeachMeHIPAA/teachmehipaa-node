// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { PartnerStatus } from "./partner-status.js";

export interface Partner {
  /** Unique identifier for the partner account. */
  readonly partnerId: string;
  /** The partner's name. */
  readonly name: string;
  /** The partner app. */
  readonly appId: string;
  /** `active` or `suspended`. */
  readonly status: PartnerStatus;
  /** How many organizations the partner can create. */
  readonly maxChildOrgs: number;
  /** How many it has created. */
  readonly childOrgCount: number;
  /** When it was created (ISO 8601). */
  readonly createdAt: string;
}
