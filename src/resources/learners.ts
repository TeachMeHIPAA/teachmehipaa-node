import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { WithLastResponse } from "../core/response.js";
import type { Learner, LearnerLaunchLink } from "../models/learner.js";

export interface LearnerRetrieveParams {
  /** The Course. Defaults to the Organization's default Course. */
  readonly courseId?: string;
}

export interface LearnerCreateParams {
  readonly email: string;
  readonly name?: string;
  /** Your own id for the Learner, unique within the Organization. */
  readonly externalId?: string;
  /** The Course to invite them to. Defaults to the Organization's default. */
  readonly courseId?: string;
  /** `email` (default) sends the invite; `none` sends nothing. */
  readonly delivery?: "email" | "none" | (string & {});
  /** `require_available` fails with 409 when no Seat is free. */
  readonly seatPolicy?: string;
}

export interface LearnerUpdateParams {
  readonly name?: string;
  /** `null` clears it. */
  readonly externalId?: string | null;
}

export class Learners {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /** Invites a Learner to a Course. */
  create(
    params: LearnerCreateParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<Learner>> {
    return this.#requester.request<Learner>({
      method: "POST",
      path: "/learners",
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "required",
      body: params,
      options,
    });
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
      retrySafe: true,
      idempotencyKey: "none",
      query: { courseId: params?.courseId },
      options,
    });
  }

  /** Changes a Learner's name or External ID. */
  update(
    learnerId: string,
    params: LearnerUpdateParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<Learner>> {
    return this.#requester.request<Learner>({
      method: "PATCH",
      path: "/learners/{learnerId}",
      pathParams: { learnerId },
      organizationScoped: true,
      retrySafe: false,
      idempotencyKey: "none",
      body: params,
      contentType: "application/merge-patch+json",
      options,
    });
  }

  /** Creates a Launch link that signs the Learner straight into training. */
  createLaunchLink(
    learnerId: string,
    options?: RequestOptions,
  ): Promise<WithLastResponse<LearnerLaunchLink>> {
    return this.#requester.request<LearnerLaunchLink>({
      method: "POST",
      path: "/learners/{learnerId}:createLaunchLink",
      pathParams: { learnerId },
      organizationScoped: true,
      // A duplicate Launch link is harmless, so no Idempotency-Key is needed.
      retrySafe: true,
      idempotencyKey: "none",
      options,
    });
  }
}
