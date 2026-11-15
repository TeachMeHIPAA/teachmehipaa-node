// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import { requestPage, type PagePromise } from "../core/pagination.js";
import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { WithLastResponse } from "../core/response.js";
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
   */
  retrieve(
    courseId: string,
    options?: RequestOptions,
  ): Promise<WithLastResponse<Course>> {
    return this.#requester.request<Course>({
      method: "GET",
      path: "/courses/{courseId}",
      pathParams: { courseId },
      organizationScoped: false,
      retrySafe: true,
      idempotencyKey: "none",
      options,
    });
  }
}
