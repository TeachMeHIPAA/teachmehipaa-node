// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { WithLastResponse } from "../core/response.js";
import type { CertificateVerification } from "../models/certificate-verification.js";

export class CertificateVerifications {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * Verify a certificate
   *
   * Verifies the certificate behind a `https://tme.so/{tinyId}` link. Needs no access token. Limited to 60 requests a minute per IP address.
   */
  retrieve(
    tinyId: string,
    options?: RequestOptions,
  ): Promise<WithLastResponse<CertificateVerification>> {
    return this.#requester.request<CertificateVerification>({
      method: "GET",
      path: "/certificate-verifications/{tinyId}",
      pathParams: { tinyId },
      organizationScoped: false,
      authenticated: false,
      retrySafe: true,
      idempotencyKey: "none",
      options,
    });
  }
}
