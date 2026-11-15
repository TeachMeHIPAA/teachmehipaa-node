// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import { requestOperation, type Operation } from "../core/operations.js";
import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";

export class Operations {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * Retrieve an operation
   *
   * Retrieves a bulk operation and its result. Operations are kept for 24 hours.
   *
   * Resolves with an Operation; `await operation.wait()` for its final state.
   */
  retrieve(operationId: string, options?: RequestOptions): Promise<Operation> {
    return requestOperation(this.#requester, {
      method: "GET",
      path: "/operations/{operationId}",
      pathParams: { operationId },
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "none",
      options,
    });
  }
}
