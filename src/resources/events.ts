// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import { requestPage, type PagePromise } from "../core/pagination.js";
import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { Event } from "../models/event.js";
import type { EventType } from "../models/event-type.js";

/** Parameters for `events.list`. */
export interface EventListParams {
  /** How many objects to return, between 1 and 100. Defaults to 20. */
  readonly limit?: number;
  /** Return events after this event id (exclusive). The previous page's `nextCursor`. */
  readonly after?: string;
  /** Filter to one event type. */
  readonly type?: EventType;
}

/** The generated methods of `events`. The client exposes the hand-written subclass in `src/extensions/events.ts`. */
export class EventsBase {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * List all events
   *
   * Returns a list of the organization's events from the last 30 days, oldest first. Pass the last `eventId` you processed as `after` to resume where you stopped, and `type` to list one event type.
   */
  list(params?: EventListParams, options?: RequestOptions): PagePromise<Event> {
    return requestPage<Event>(
      this.#requester,
      {
        method: "GET",
        path: "/events",
        organizationScoped: true,
        retrySafe: true,
        idempotencyKey: "none",
        query: {
          limit: params?.limit,
          after: params?.after,
          type: params?.type,
        },
        options,
      },
      { style: "after", cursorParam: "after" },
    );
  }
}
