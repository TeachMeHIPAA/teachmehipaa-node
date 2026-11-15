// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { WithLastResponse } from "../core/response.js";
import type { TokenIntrospection } from "../models/token-introspection.js";

export class Auth {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * Retrieve the current token
   *
   * Describes the access token you call with: whether it belongs to an API client or a person, its organization, its scopes and when it expires. Needs no scope.
   */
  introspect(
    options?: RequestOptions,
  ): Promise<WithLastResponse<TokenIntrospection>> {
    return this.#requester.request<TokenIntrospection>({
      method: "GET",
      path: "/auth/introspection",
      organizationScoped: false,
      retrySafe: true,
      idempotencyKey: "none",
      options,
    });
  }
}
