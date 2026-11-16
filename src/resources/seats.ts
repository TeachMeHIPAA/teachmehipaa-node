// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { WithLastResponse } from "../core/response.js";
import type { SeatsInventory } from "../models/seats-inventory.js";

export class Seats {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * Retrieve the seat inventory
   *
   * Retrieves how many seats the organization has, how many are assigned and how many are available for new invites. Requires the `enrollments:read` scope.
   */
  retrieve(
    options?: RequestOptions,
  ): Promise<WithLastResponse<SeatsInventory>> {
    return this.#requester.request<SeatsInventory>({
      method: "GET",
      path: "/seats",
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "none",
      options,
    });
  }
}
