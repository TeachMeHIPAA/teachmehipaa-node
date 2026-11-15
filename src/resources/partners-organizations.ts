// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import { requestPage, type PagePromise } from "../core/pagination.js";
import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { WithLastResponse } from "../core/response.js";
import type { PartnerOrganization } from "../models/partner-organization.js";
import type { PartnerOrganizationCreate } from "../models/partner-organization-create.js";
import type { PartnerOrganizationCreated } from "../models/partner-organization-created.js";

/** Parameters for `partners.organizations.create`. */
export type PartnerOrganizationCreateParams = PartnerOrganizationCreate;

/** Parameters for `partners.organizations.list`. */
export interface PartnerOrganizationListParams {
  /** How many objects to return, between 1 and 100. Defaults to 20. */
  readonly limit?: number;
  /** The `nextCursor` from the previous page. */
  readonly cursor?: string;
}

export class PartnerOrganizations {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * Create a customer organization
   *
   * Creates an organization for a customer with your app already connected, and emails its administrator a link to sign in. The organization has no seats until seats are bought for it. Requires the `partner:orgs:write` scope.
   */
  create(
    partnerId: string,
    params: PartnerOrganizationCreateParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<PartnerOrganizationCreated>> {
    return this.#requester.request<PartnerOrganizationCreated>({
      method: "POST",
      path: "/partners/{partnerId}/organizations",
      pathParams: { partnerId },
      organizationScoped: false,
      retrySafe: true,
      idempotencyKey: "required",
      body: params,
      options,
    });
  }

  /**
   * List all customer organizations
   *
   * Returns a list of the organizations you created. `grantActive` is `false` once a customer disconnects your app. Requires the `partner:orgs:read` scope.
   */
  list(
    partnerId: string,
    params?: PartnerOrganizationListParams,
    options?: RequestOptions,
  ): PagePromise<PartnerOrganization> {
    return requestPage<PartnerOrganization>(this.#requester, {
      method: "GET",
      path: "/partners/{partnerId}/organizations",
      pathParams: { partnerId },
      organizationScoped: false,
      retrySafe: true,
      idempotencyKey: "none",
      query: { limit: params?.limit, cursor: params?.cursor },
      options,
    });
  }
}
