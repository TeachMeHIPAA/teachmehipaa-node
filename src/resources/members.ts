// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import { requestPage, type PagePromise } from "../core/pagination.js";
import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { WithLastResponse } from "../core/response.js";
import type { ListMembersRole } from "../models/list-members-role.js";
import type { Member } from "../models/member.js";
import type { MemberListItem } from "../models/member-list-item.js";

/** Parameters for `members.list`. */
export interface MemberListParams {
  /** How many objects to return, between 1 and 1000. Defaults to 20. */
  readonly limit?: number;
  /** The `nextCursor` from the previous page. */
  readonly cursor?: string;
  /** Opt-in, comma-separated. With `enrollmentSubject`, a member whose `subjectId` is null carries `enrollmentSubjectId`: the subject their email resolves to (a never-signed-in invitee), or null when none. Use it only to match the member to Enrollments; it is not an address for member routes. With `holdsInvitation`, each learner carries `holdsInvitation`: whether the organization has an invitation for their email or a Seat bound to them. Each key is omitted when its lookup failed. */
  readonly include?: string;
  /** Only admins (paginated). */
  readonly role?: ListMembersRole;
}

export class Members {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * List all members
   *
   * Returns a list of the organization's members, its admins and learners. Pass `role=admin` to list only admins.
   */
  list(
    params?: MemberListParams,
    options?: RequestOptions,
  ): PagePromise<MemberListItem> {
    return requestPage<MemberListItem>(
      this.#requester,
      {
        method: "GET",
        path: "/members",
        organizationScoped: true,
        authenticated: true,
        retrySafe: true,
        idempotencyKey: "none",
        query: {
          limit: params?.limit,
          cursor: params?.cursor,
          include: params?.include,
          role: params?.role,
        },
        options,
      },
      { style: "cursor", cursorParam: "cursor" },
    );
  }

  /**
   * Retrieve a member
   *
   * Retrieves a member of the organization.
   */
  retrieve(
    subjectId: string,
    options?: RequestOptions,
  ): Promise<WithLastResponse<Member>> {
    return this.#requester.request<Member>({
      method: "GET",
      path: "/members/{subjectId}",
      pathParams: { subjectId },
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "none",
      options,
    });
  }
}
