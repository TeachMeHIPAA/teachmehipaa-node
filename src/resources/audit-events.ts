// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import { requestPage, type PagePromise } from "../core/pagination.js";
import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { AuditEvent } from "../models/audit-event.js";
import type { ListAuditEventsTransition } from "../models/list-audit-events-transition.js";
import type { ListAuditEventsType } from "../models/list-audit-events-type.js";

/** Parameters for `auditEvents.list`. */
export interface AuditEventListParams {
  /** How many objects to return, between 1 and 100. Defaults to 20. */
  readonly limit?: number;
  /** The `nextCursor` from the previous page. */
  readonly cursor?: string;
  /** Filter to one audit-event family. */
  readonly type?: ListAuditEventsType;
  /** Filter to one lifecycle transition. */
  readonly transition?: ListAuditEventsTransition;
  /** Filter to one member (canonical subject id). */
  readonly subjectId?: string;
  /**
   * Inclusive lower bound on `at` (ISO-8601 instant).
   *
   * An ISO 8601 date-time string.
   */
  readonly since?: string;
  /**
   * Inclusive upper bound on `at` (ISO-8601 instant).
   *
   * An ISO 8601 date-time string.
   */
  readonly until?: string;
}

export class AuditEvents {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * List all audit events
   *
   * Returns a list of the organization's audit events, newest first. Filter by `type`, `transition`, `subjectId`, or a `since` and `until` range.
   */
  list(
    params?: AuditEventListParams,
    options?: RequestOptions,
  ): PagePromise<AuditEvent> {
    return requestPage<AuditEvent>(
      this.#requester,
      {
        method: "GET",
        path: "/audit-events",
        organizationScoped: true,
        retrySafe: true,
        idempotencyKey: "none",
        query: {
          limit: params?.limit,
          cursor: params?.cursor,
          type: params?.type,
          transition: params?.transition,
          subjectId: params?.subjectId,
          since: params?.since,
          until: params?.until,
        },
        options,
      },
      { style: "cursor", cursorParam: "cursor" },
    );
  }
}
