import { pause, type Clock } from "../core/clock.js";
import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { Event } from "../models/event.js";
import { EventsBase, type EventListParams } from "../resources/events.js";

/** Parameters for `events.tail`. */
export interface EventTailParams extends Omit<EventListParams, "after"> {
  /**
   * Yield only Events after this id (exclusive), such as a saved
   * `lastEventId`. Omit it, or pass `undefined` (nothing saved yet), to
   * start at the oldest retained Event.
   */
  readonly after?: string | undefined;
  /** Once caught up, keep polling for new Events instead of returning. */
  readonly follow?: boolean;
  /** Milliseconds between polls once caught up in follow mode. Defaults to 2000. */
  readonly interval?: number;
  /**
   * Ends the tail at the next Event or poll, including mid-wait; the loop then
   * exits normally. A request already in flight finishes first.
   */
  readonly signal?: AbortSignal;
}

/** A position in the Event log that you iterate with `for await`. */
export interface EventTail extends AsyncIterable<Event> {
  /**
   * The id of the last Event the tail handed out, or the `after` it started
   * from. Save it to resume from the same place after a restart.
   */
  readonly lastEventId: string | null;
}

const DEFAULT_INTERVAL = 2000;

export class Events extends EventsBase {
  readonly #clock: Clock;

  constructor(requester: Requester) {
    super(requester);
    this.#clock = requester.clock;
  }

  /**
   * Tail the event log
   *
   * Iterates the organization's events oldest first, from `after` onward. The
   * log's `nextCursor` is `null` at the current end, so the tail keeps its own
   * position in `lastEventId`. Once caught up it returns, or with `follow`
   * polls again every `interval` until you break out of the loop or `signal`
   * aborts.
   */
  tail(params: EventTailParams = {}, options?: RequestOptions): EventTail {
    const {
      after,
      follow = false,
      interval = DEFAULT_INTERVAL,
      signal,
      ...filters
    } = params;
    const clock = this.#clock;
    const aborted = () => signal?.aborted === true;
    const eventsAfter = (position: string | null) =>
      this.list(
        position === null ? filters : { ...filters, after: position },
        options,
      );
    let lastEventId = after ?? null;
    return {
      get lastEventId() {
        return lastEventId;
      },
      async *[Symbol.asyncIterator]() {
        while (!aborted()) {
          for await (const event of eventsAfter(lastEventId)) {
            if (aborted()) {
              return;
            }
            lastEventId = event.eventId;
            yield event;
            if (aborted()) {
              return;
            }
          }
          if (!follow || aborted()) {
            return;
          }
          await pause(clock, interval, signal);
        }
      },
    };
  }
}
