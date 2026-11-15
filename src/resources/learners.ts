// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import { requestOperation, type Operation } from "../core/operations.js";
import { requestPage, type PagePromise } from "../core/pagination.js";
import type {
  ConditionalWriteOptions,
  RequestOptions,
} from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { WithLastResponse } from "../core/response.js";
import type { Learner } from "../models/learner.js";
import type { LearnerBatchUpsertRequest } from "../models/learner-batch-upsert-request.js";
import type { LearnerCreateRequest } from "../models/learner-create-request.js";
import type { LearnerLaunchLink } from "../models/learner-launch-link.js";
import type { LearnerPatch } from "../models/learner-patch.js";
import type { LearnerRemindAccepted } from "../models/learner-remind-accepted.js";
import type { LearnerStatus } from "../models/learner-status.js";
import type { LearnerUpsertRequest } from "../models/learner-upsert-request.js";
import type { LearnerWriteResult } from "../models/learner-write-result.js";
import type { LearnersExportRequest } from "../models/learners-export-request.js";

/** Parameters for `learners.batchUpsert`. */
export type LearnerBatchUpsertParams = LearnerBatchUpsertRequest;

/** Parameters for `learners.create`. */
export type LearnerCreateParams = LearnerCreateRequest;

/** Parameters for `learners.createLaunchLink`. */
export interface LearnerCreateLaunchLinkParams {
  /** The course. Defaults to the organization's default course. */
  readonly courseId?: string;
}

/** Parameters for `learners.export`. */
export type LearnerExportParams = LearnersExportRequest;

/** Parameters for `learners.list`. */
export interface LearnerListParams {
  /** How many objects to return, between 1 and 100. Defaults to 20. */
  readonly limit?: number;
  /** The `nextCursor` from the previous page. */
  readonly cursor?: string;
  readonly email?: string;
  /** The integration's own id for the learner (unique per organization), or the SCIM `externalId` when none was set. */
  readonly externalId?: string;
  readonly status?: LearnerStatus;
  /** The course. Defaults to the organization's default course. */
  readonly courseId?: string;
}

/** Parameters for `learners.offboard`. */
export interface LearnerOffboardParams {
  /** The course. Defaults to the organization's default course. */
  readonly courseId?: string;
}

/** Parameters for `learners.remind`. */
export interface LearnerRemindParams {
  /** The course. Defaults to the organization's default course. */
  readonly courseId?: string;
}

/** Parameters for `learners.retrieve`. */
export interface LearnerRetrieveParams {
  /** The course. Defaults to the organization's default course. */
  readonly courseId?: string;
}

/** Parameters for `learners.update`. */
export interface LearnerUpdateParams extends LearnerPatch {
  /** The course. Defaults to the organization's default course. */
  readonly courseId?: string;
}

/** Parameters for `learners.upsertByExternalId`. */
export type LearnerUpsertByExternalIdParams = LearnerUpsertRequest;

export class Learners {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * Create many learners
   *
   * Creates or retrieves up to 500 learners in one request. Each item works like creating one learner and succeeds or fails on its own.
   *
   * Resolves with an Operation; `await operation.wait()` for its final state.
   */
  batchUpsert(
    params: LearnerBatchUpsertParams,
    options?: RequestOptions,
  ): Promise<Operation> {
    return requestOperation(this.#requester, {
      method: "POST",
      path: "/learners:batchUpsert",
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "required",
      body: params,
      options,
    });
  }

  /**
   * Create a learner
   *
   * Adds a person to the organization and invites them to a course in one call, using one seat. If the email or `externalId` already belongs to an active learner in the course, nothing is created. With `delivery: "none"`, no email is sent and the response includes a `joinUrl` for you to deliver.
   */
  create(
    params: LearnerCreateParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<LearnerWriteResult>> {
    return this.#requester.request<LearnerWriteResult>({
      method: "POST",
      path: "/learners",
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "required",
      body: params,
      response: { kind: "writeResult" },
      options,
    });
  }

  /**
   * Create a launch link
   *
   * Creates a link that opens the course with the learner already signed in, for a "Start training" button in your product. The link works once and expires after 5 minutes: create it when the learner clicks, then redirect them to it. Never email, store or log it. Only for a learner who has accepted their invite.
   */
  createLaunchLink(
    learnerId: string,
    params?: LearnerCreateLaunchLinkParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<LearnerLaunchLink>> {
    return this.#requester.request<LearnerLaunchLink>({
      method: "POST",
      path: "/learners/{learnerId}:createLaunchLink",
      pathParams: { learnerId },
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "none",
      query: { courseId: params?.courseId },
      options,
    });
  }

  /**
   * Export learners
   *
   * Exports the organization's learners in one course as CSV, optionally only those with one `status`. Requires the `learners:read` scope.
   *
   * Resolves with an Operation; `await operation.wait()` for its final state.
   */
  export(
    params: LearnerExportParams,
    options?: RequestOptions,
  ): Promise<Operation> {
    return requestOperation(this.#requester, {
      method: "POST",
      path: "/learners:export",
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "required",
      body: params,
      options,
    });
  }

  /**
   * List all learners
   *
   * Returns a list of the organization's learners in one course, with each learner's status, dates and current certificate. Filter by `status`, or find one learner by `email` or `externalId`.
   */
  list(
    params?: LearnerListParams,
    options?: RequestOptions,
  ): PagePromise<Learner> {
    return requestPage<Learner>(
      this.#requester,
      {
        method: "GET",
        path: "/learners",
        organizationScoped: true,
        retrySafe: true,
        idempotencyKey: "none",
        query: {
          limit: params?.limit,
          cursor: params?.cursor,
          email: params?.email,
          externalId: params?.externalId,
          status: params?.status,
          courseId: params?.courseId,
        },
        options,
      },
      { style: "cursor", cursorParam: "cursor" },
    );
  }

  /**
   * Offboard a learner
   *
   * Removes a learner from the organization. A learner who hasn't started has their invite cancelled and the seat returned; a learner who has started keeps their training history and certificates. Releases the learner's `externalId`.
   *
   * Pass `ifMatch` to make the call conditional on the object's ETag; a stale one raises `PreconditionFailedError` (412).
   */
  offboard(
    learnerId: string,
    params?: LearnerOffboardParams,
    options?: ConditionalWriteOptions,
  ): Promise<WithLastResponse<Learner>> {
    return this.#requester.request<Learner>({
      method: "POST",
      path: "/learners/{learnerId}:offboard",
      pathParams: { learnerId },
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "required",
      query: { courseId: params?.courseId },
      ifMatch: options?.ifMatch,
      options,
    });
  }

  /**
   * Remind a learner
   *
   * Emails the learner a reminder: the invite again if they haven't started, or a nudge to finish if they have.
   */
  remind(
    learnerId: string,
    params?: LearnerRemindParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<LearnerRemindAccepted>> {
    return this.#requester.request<LearnerRemindAccepted>({
      method: "POST",
      path: "/learners/{learnerId}:remind",
      pathParams: { learnerId },
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "required",
      query: { courseId: params?.courseId },
      options,
    });
  }

  /**
   * Retrieve a learner
   *
   * Retrieves a learner's status in one course.
   */
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

  /**
   * Update a learner
   *
   * Updates a learner's `name` or `externalId`; parameters you don't send are left unchanged. Send the body as `application/merge-patch+json` with the learner's current `ETag` in `If-Match`.
   *
   * Pass the object's current ETag as `ifMatch`, such as the object you read: `{ ifMatch: object }`. Without it the API refuses the write with `PreconditionFailedError` (428); with a stale one, the same error (412).
   */
  update(
    learnerId: string,
    params: LearnerUpdateParams,
    options?: ConditionalWriteOptions,
  ): Promise<WithLastResponse<Learner>> {
    const { courseId, ...body } = params;
    return this.#requester.request<Learner>({
      method: "PATCH",
      path: "/learners/{learnerId}",
      pathParams: { learnerId },
      organizationScoped: true,
      retrySafe: false,
      idempotencyKey: "none",
      query: { courseId },
      body: body,
      contentType: "application/merge-patch+json",
      ifMatch: options?.ifMatch,
      options,
    });
  }

  /**
   * Create or retrieve a learner by your id
   *
   * Makes sure a learner exists for your own id. Creates and invites the learner the first time, and returns them on every later call, so a sync job can replay it safely. Never uses a second seat.
   */
  upsertByExternalId(
    externalId: string,
    params: LearnerUpsertByExternalIdParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<LearnerWriteResult>> {
    return this.#requester.request<LearnerWriteResult>({
      method: "PUT",
      path: "/learners/by-external-id/{externalId}",
      pathParams: { externalId },
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "required",
      body: params,
      response: { kind: "writeResult" },
      options,
    });
  }
}
