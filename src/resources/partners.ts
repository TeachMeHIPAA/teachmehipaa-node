// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { WithLastResponse } from "../core/response.js";
import type { Partner } from "../models/partner.js";
import { PartnerOrganizations } from "./partners-organizations.js";

export class Partners {
  readonly #requester: Requester;
  readonly organizations: PartnerOrganizations;

  constructor(requester: Requester) {
    this.#requester = requester;
    this.organizations = new PartnerOrganizations(requester);
  }

  /**
   * Retrieve your partner account
   *
   * Retrieves your partner account, including how many organizations you can create. Requires the `partner:orgs:read` scope.
   */
  retrieve(
    partnerId: string,
    options?: RequestOptions,
  ): Promise<WithLastResponse<Partner>> {
    return this.#requester.request<Partner>({
      method: "GET",
      path: "/partners/{partnerId}",
      pathParams: { partnerId },
      organizationScoped: false,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "none",
      options,
    });
  }
}
