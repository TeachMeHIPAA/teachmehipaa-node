// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import { requestOperation, type Operation } from "../core/operations.js";
import { requestPage, type PagePromise } from "../core/pagination.js";
import type {
  ConditionalReadOptions,
  ETagSource,
  RequestOptions,
} from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { NotModified, WithLastResponse } from "../core/response.js";
import type { CancelEnrollmentResponse } from "../models/cancel-enrollment-response.js";
import type { Enrollment } from "../models/enrollment.js";
import type { EnrollmentActionAccepted } from "../models/enrollment-action-accepted.js";
import type { EnrollmentCancelRequest } from "../models/enrollment-cancel-request.js";
import type { EnrollmentCreateRequest } from "../models/enrollment-create-request.js";
import type { EnrollmentsBatchRequest } from "../models/enrollments-batch-request.js";
import type { EnrollmentsBatchRequestSelectEnrollmentIds } from "../models/enrollments-batch-request-select-enrollment-ids.js";
import type { EnrollmentsBatchRequestSelectFilter } from "../models/enrollments-batch-request-select-filter.js";
import type { EnrollmentsBatchResults } from "../models/enrollments-batch-results.js";
import type { EnrollmentsExportRequest } from "../models/enrollments-export-request.js";
import type { ImportEnrollmentsRequest } from "../models/import-enrollments-request.js";
import type { ImportOptions } from "../models/import-options.js";
import type { ImportPreview } from "../models/import-preview.js";
import type { ListEnrollmentsArchived } from "../models/list-enrollments-archived.js";
import type { ListEnrollmentsInclude } from "../models/list-enrollments-include.js";
import type { ListEnrollmentsStatus } from "../models/list-enrollments-status.js";
import type { OrgEnrollmentListItem } from "../models/org-enrollment-list-item.js";

/** Parameters for `enrollments.batch`. */
export interface EnrollmentBatchParams extends Omit<
  EnrollmentsBatchRequest,
  "select"
> {
  /** The enrollments to act on: a list of `enrollmentIds` (up to 500), or a `filter`. */
  readonly select: EnrollmentsBatchRequestSelectEnrollmentIds;
}

/** Parameters for `enrollments.batchByFilter`. */
export interface EnrollmentBatchByFilterParams extends Omit<
  EnrollmentsBatchRequest,
  "select"
> {
  /** The enrollments to act on: a list of `enrollmentIds` (up to 500), or a `filter`. */
  readonly select: EnrollmentsBatchRequestSelectFilter;
}

/** Parameters for `enrollments.cancel`. */
export type EnrollmentCancelParams = EnrollmentCancelRequest;

/** Parameters for `enrollments.create`. */
export type EnrollmentCreateParams = EnrollmentCreateRequest;

/** Parameters for `enrollments.export`. */
export type EnrollmentExportParams = EnrollmentsExportRequest;

/** Parameters for `enrollments.import`. */
export interface EnrollmentImportParams extends Omit<
  ImportEnrollmentsRequest,
  "options"
> {
  readonly options?: Omit<ImportOptions, "validateOnly">;
}

/** Parameters for `enrollments.list`. */
export interface EnrollmentListParams {
  /** How many objects to return, between 1 and 1000. Defaults to 20. */
  readonly limit?: number;
  /** The `nextCursor` from the previous page. */
  readonly cursor?: string;
  /** Filter on the derived effectiveStatus. */
  readonly status?: ListEnrollmentsStatus;
  readonly courseId?: string;
  readonly archived?: ListEnrollmentsArchived;
  /** Opt-in enrichment. With `priorCertificate`, an item carries `priorCertificate` (object, or null when the server confirmed there is none). The key is omitted on an item whose answer is unknown, and on every item of the page if the certificate lookup failed; clients must treat a missing key as unknown, never as null. */
  readonly include?: ListEnrollmentsInclude;
}

/** Parameters for `enrollments.previewImport`. */
export interface EnrollmentPreviewImportParams extends Omit<
  ImportEnrollmentsRequest,
  "options"
> {
  readonly options?: Omit<ImportOptions, "validateOnly">;
}

export class Enrollments {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * Update many enrollments
   *
   * Reminds, resends, cancels, renews, archives or unarchives up to 500 enrollments in one request, chosen by id or by filter. Each enrollment succeeds or fails on its own. Requires the `enrollments:write` scope.
   */
  batch(
    params: EnrollmentBatchParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<EnrollmentsBatchResults>> {
    return this.#requester.request<EnrollmentsBatchResults>({
      method: "POST",
      path: "/enrollments:batch",
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "required",
      body: params,
      options,
    });
  }

  /**
   * Update many enrollments
   *
   * Reminds, resends, cancels, renews, archives or unarchives up to 500 enrollments in one request, chosen by id or by filter. Each enrollment succeeds or fails on its own. Requires the `enrollments:write` scope.
   *
   * Resolves with an Operation; `await operation.wait()` for its final state.
   */
  batchByFilter(
    params: EnrollmentBatchByFilterParams,
    options?: RequestOptions,
  ): Promise<Operation> {
    return requestOperation(this.#requester, {
      method: "POST",
      path: "/enrollments:batch",
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "required",
      body: params,
      options,
    });
  }

  /**
   * Cancel an enrollment
   *
   * Cancels an invite that hasn't been accepted yet and returns its seat to the pool. With `refund: true`, refunds the seat to the card that paid for it instead. The enrollment remains, with status `CANCELLED`. Requires the `enrollments:write` scope.
   */
  cancel(
    enrollmentId: string,
    params?: EnrollmentCancelParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<CancelEnrollmentResponse>> {
    return this.#requester.request<CancelEnrollmentResponse>({
      method: "POST",
      path: "/enrollments/{enrollmentId}:cancel",
      pathParams: { enrollmentId },
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "required",
      body: params,
      options,
    });
  }

  /**
   * Create an enrollment
   *
   * Invites a person to a course, creating their profile if needed, and uses one seat. The course defaults to `hipaa`. Requires the `enrollments:write` scope.
   */
  create(
    params: EnrollmentCreateParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<Enrollment>> {
    return this.#requester.request<Enrollment>({
      method: "POST",
      path: "/enrollments",
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "required",
      body: params,
      options,
    });
  }

  /**
   * Export enrollments
   *
   * Exports the organization's enrollments as CSV. Requires the `enrollments:read` scope.
   *
   * Resolves with an Operation; `await operation.wait()` for its final state.
   */
  export(
    params: EnrollmentExportParams,
    options?: RequestOptions,
  ): Promise<Operation> {
    return requestOperation(this.#requester, {
      method: "POST",
      path: "/enrollments:export",
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "required",
      body: params,
      options,
    });
  }

  /**
   * Import learners from CSV
   *
   * Invites everyone in a CSV file with an `email` column (and optional `name` and `courseId`). Send `validateOnly: true` first to preview the file without inviting anyone. Up to 500 rows. Requires the `enrollments:write` scope.
   *
   * Resolves with an Operation; `await operation.wait()` for its final state.
   */
  import(
    params: EnrollmentImportParams,
    options?: RequestOptions,
  ): Promise<Operation> {
    return requestOperation(this.#requester, {
      method: "POST",
      path: "/enrollments:import",
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "required",
      body: { ...params, options: { ...params.options, validateOnly: false } },
      contentType: "multipart/form-data",
      binaryParts: [{ contentType: "text/csv", name: "file" }],
      options,
    });
  }

  /**
   * List all enrollments
   *
   * Returns a list of the organization's enrollments. Filter by `status`, `courseId` or `archived`. Requires the `enrollments:read` scope.
   */
  list(
    params?: EnrollmentListParams,
    options?: RequestOptions,
  ): PagePromise<OrgEnrollmentListItem> {
    return requestPage<OrgEnrollmentListItem>(
      this.#requester,
      {
        method: "GET",
        path: "/enrollments",
        organizationScoped: true,
        authenticated: true,
        retrySafe: true,
        idempotencyKey: "none",
        query: {
          limit: params?.limit,
          cursor: params?.cursor,
          status: params?.status,
          courseId: params?.courseId,
          archived: params?.archived,
          include: params?.include,
        },
        options,
      },
      { style: "cursor", cursorParam: "cursor" },
    );
  }

  /**
   * Import learners from CSV
   *
   * Invites everyone in a CSV file with an `email` column (and optional `name` and `courseId`). Send `validateOnly: true` first to preview the file without inviting anyone. Up to 500 rows. Requires the `enrollments:write` scope.
   */
  previewImport(
    params: EnrollmentPreviewImportParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<ImportPreview>> {
    return this.#requester.request<ImportPreview>({
      method: "POST",
      path: "/enrollments:import",
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "required",
      body: { ...params, options: { ...params.options, validateOnly: true } },
      contentType: "multipart/form-data",
      binaryParts: [{ contentType: "text/csv", name: "file" }],
      options,
    });
  }

  /**
   * Remind an enrollment
   *
   * Emails the learner again: the invitation if they haven't joined, or a reminder linking to the training if they have. Requires the `enrollments:write` scope.
   */
  remind(
    enrollmentId: string,
    options?: RequestOptions,
  ): Promise<WithLastResponse<EnrollmentActionAccepted>> {
    return this.#requester.request<EnrollmentActionAccepted>({
      method: "POST",
      path: "/enrollments/{enrollmentId}:remind",
      pathParams: { enrollmentId },
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "required",
      options,
    });
  }

  /**
   * Renew an enrollment
   *
   * Starts the next certification cycle for a certified learner and invites them again, using one seat. Retrying never uses a second seat. Requires the `enrollments:write` scope.
   */
  renew(
    enrollmentId: string,
    options?: RequestOptions,
  ): Promise<WithLastResponse<Enrollment>> {
    return this.#requester.request<Enrollment>({
      method: "POST",
      path: "/enrollments/{enrollmentId}:renew",
      pathParams: { enrollmentId },
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "required",
      options,
    });
  }

  /**
   * Resend an invite
   *
   * Sends a pending invite again, within the same cycle. To invite a certified learner again, renew the enrollment. Requires the `enrollments:write` scope.
   */
  resendInvite(
    enrollmentId: string,
    options?: RequestOptions,
  ): Promise<WithLastResponse<EnrollmentActionAccepted>> {
    return this.#requester.request<EnrollmentActionAccepted>({
      method: "POST",
      path: "/enrollments/{enrollmentId}:resendInvite",
      pathParams: { enrollmentId },
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "required",
      options,
    });
  }

  /**
   * Retrieve an enrollment
   *
   * Retrieves an enrollment. Requires the `enrollments:read` scope.
   *
   * Pass the ETag of the copy you hold as `ifNoneMatch` (or the copy itself) to skip the transfer when it's current: the call then resolves `NotModified`.
   */
  retrieve(
    enrollmentId: string,
    options: ConditionalReadOptions & { readonly ifNoneMatch: ETagSource },
  ): Promise<WithLastResponse<Enrollment> | NotModified>;
  /**
   * Retrieve an enrollment
   *
   * Retrieves an enrollment. Requires the `enrollments:read` scope.
   *
   * Pass the ETag of the copy you hold as `ifNoneMatch` (or the copy itself) to skip the transfer when it's current: the call then resolves `NotModified`.
   */
  retrieve(
    enrollmentId: string,
    options?: RequestOptions & { readonly ifNoneMatch?: never },
  ): Promise<WithLastResponse<Enrollment>>;
  /**
   * Retrieve an enrollment
   *
   * Retrieves an enrollment. Requires the `enrollments:read` scope.
   *
   * Pass the ETag of the copy you hold as `ifNoneMatch` (or the copy itself) to skip the transfer when it's current: the call then resolves `NotModified`.
   */
  retrieve(
    enrollmentId: string,
    options?: ConditionalReadOptions,
  ): Promise<WithLastResponse<Enrollment> | NotModified>;
  retrieve(
    enrollmentId: string,
    options?: ConditionalReadOptions,
  ): Promise<WithLastResponse<Enrollment> | NotModified> {
    return this.#requester.request<Enrollment | NotModified>({
      method: "GET",
      path: "/enrollments/{enrollmentId}",
      pathParams: { enrollmentId },
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "none",
      ifNoneMatch: options?.ifNoneMatch,
      options,
    });
  }
}
