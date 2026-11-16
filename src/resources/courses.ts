// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import { requestPage, type PagePromise } from "../core/pagination.js";
import type {
  ConditionalReadOptions,
  ETagSource,
  RequestOptions,
} from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { NotModified, WithLastResponse } from "../core/response.js";
import type { Course } from "../models/course.js";

/** Parameters for `courses.list`. */
export interface CourseListParams {
  /** How many objects to return, between 1 and 100. Defaults to 20. */
  readonly limit?: number;
  /** The `nextCursor` from the previous page. */
  readonly cursor?: string;
}

export class Courses {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * List all courses
   *
   * Returns a list of the courses in the public catalog. Needs no access token.
   */
  list(
    params?: CourseListParams,
    options?: RequestOptions,
  ): PagePromise<Course> {
    return requestPage<Course>(
      this.#requester,
      {
        method: "GET",
        path: "/courses",
        organizationScoped: false,
        authenticated: false,
        retrySafe: true,
        idempotencyKey: "none",
        query: { limit: params?.limit, cursor: params?.cursor },
        options,
      },
      { style: "cursor", cursorParam: "cursor" },
    );
  }

  /**
   * Retrieve a course
   *
   * Retrieves a course from the public catalog.
   *
   * Pass the ETag of the copy you hold as `ifNoneMatch` (or the copy itself) to skip the transfer when it's current: the call then resolves `NotModified`.
   */
  retrieve(
    courseId: string,
    options: ConditionalReadOptions & { readonly ifNoneMatch: ETagSource },
  ): Promise<WithLastResponse<Course> | NotModified>;
  /**
   * Retrieve a course
   *
   * Retrieves a course from the public catalog.
   *
   * Pass the ETag of the copy you hold as `ifNoneMatch` (or the copy itself) to skip the transfer when it's current: the call then resolves `NotModified`.
   */
  retrieve(
    courseId: string,
    options?: RequestOptions & { readonly ifNoneMatch?: never },
  ): Promise<WithLastResponse<Course>>;
  /**
   * Retrieve a course
   *
   * Retrieves a course from the public catalog.
   *
   * Pass the ETag of the copy you hold as `ifNoneMatch` (or the copy itself) to skip the transfer when it's current: the call then resolves `NotModified`.
   */
  retrieve(
    courseId: string,
    options?: ConditionalReadOptions,
  ): Promise<WithLastResponse<Course> | NotModified>;
  retrieve(
    courseId: string,
    options?: ConditionalReadOptions,
  ): Promise<WithLastResponse<Course> | NotModified> {
    return this.#requester.request<Course | NotModified>({
      method: "GET",
      path: "/courses/{courseId}",
      pathParams: { courseId },
      organizationScoped: false,
      authenticated: false,
      retrySafe: true,
      idempotencyKey: "none",
      ifNoneMatch: options?.ifNoneMatch,
      options,
    });
  }
}
