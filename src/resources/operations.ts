// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { WithLastResponse } from "../core/response.js";
import type { Operation } from "../models/operation.js";

export class Operations {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * Retrieve an operation
   *
   * Retrieves a bulk operation and its result. Operations are kept for 24 hours.
   */
  retrieve(
    operationId: string,
    options?: RequestOptions,
  ): Promise<WithLastResponse<Operation>> {
    return this.#requester.request<Operation>({
      method: "GET",
      path: "/operations/{operationId}",
      pathParams: { operationId },
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "none",
      options,
    });
  }
}
