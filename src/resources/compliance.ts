// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { WithLastResponse } from "../core/response.js";
import type { ComplianceSummary } from "../models/compliance-summary.js";

/** Parameters for `compliance.retrieve`. */
export interface ComplianceRetrieveParams {
  /** The course. Defaults to the organization's default course. */
  readonly courseId?: string;
}

export class Compliance {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * Retrieve the compliance summary
   *
   * Counts the organization's learners in one course by status. Removed learners aren't counted.
   */
  retrieve(
    params?: ComplianceRetrieveParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<ComplianceSummary>> {
    return this.#requester.request<ComplianceSummary>({
      method: "GET",
      path: "/compliance",
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "none",
      query: { courseId: params?.courseId },
      options,
    });
  }
}
