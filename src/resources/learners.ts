import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { WithLastResponse } from "../core/response.js";
import type { Learner } from "../models/learner.js";

export interface LearnerRetrieveParams {
  /** The Course. Defaults to the Organization's default Course. */
  readonly courseId?: string;
}

export class Learners {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /** Retrieves a Learner's status in one Course. */
  retrieve(
    learnerId: string,
    params?: LearnerRetrieveParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<Learner>> {
    return this.#requester.request<Learner>({
      method: "GET",
      path: "/learners/{learnerId}",
      pathParams: { learnerId },
      organizationScoped: true,
      query: { courseId: params?.courseId },
      options,
    });
  }
}
