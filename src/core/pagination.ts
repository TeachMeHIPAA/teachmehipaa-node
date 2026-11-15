import type { QueryParams, Requester, RequestSpec } from "./requester.js";
import type { WithLastResponse } from "./response.js";

/**
 * How a list asks for its next page, from the IR. `cursor` lists pass the
 * opaque `nextCursor`; the Event log (`after`) passes the last Event's id.
 */
export interface Pagination {
  readonly style: "cursor" | "after";
  /** The query parameter that carries the position, e.g. `cursor`. */
  readonly cursorParam: string;
}

interface PageBody<T> {
  readonly items: readonly T[];
  /** `null` on the last page. */
  readonly nextCursor: string | null;
}

/** One page of a list, with the means to fetch the pages after it. */
export type Page<T> = WithLastResponse<PageBody<T>> & {
  /** Whether the API said more items follow (`nextCursor` is not `null`). */
  hasNextPage(): boolean;
  /**
   * Fetches the next page with the same filters and limit. Check
   * `hasNextPage()` first: on the last page this rejects.
   */
  getNextPage(): Promise<Page<T>>;
  /** This page, then each page after it, fetched only as you ask for it. */
  iterPages(): AsyncGenerator<Page<T>, void, undefined>;
};

/**
 * What a list method returns. Await it for the first page, or iterate it with
 * `for await` to get every item across all pages, fetched lazily.
 */
export type PagePromise<T> = Promise<Page<T>> &
  AsyncIterable<T> & {
    /**
     * Collects items from every page into one array, stopping at `limit`
     * items. The limit is required (at most 10,000) so a large list can't
     * fill memory by accident.
     */
    autoPagingToArray(options: { readonly limit: number }): Promise<T[]>;
  };

// Stripe's cap, for the same reason.
const MAX_ARRAY_LIMIT = 10_000;

const positionAfter = (
  items: readonly unknown[],
  nextCursor: string,
  style: Pagination["style"],
): string => {
  if (style === "cursor") {
    return nextCursor;
  }
  // The Event log keys on Event ids: `nextCursor` is the last id while more
  // rows exist, so the last Event is the authoritative position.
  const last: unknown = items.at(-1);
  const eventId =
    typeof last === "object" && last !== null && "eventId" in last
      ? last.eventId
      : undefined;
  return typeof eventId === "string" ? eventId : nextCursor;
};

// Methods are non-enumerable, like `lastResponse`, so spreading or
// serializing a page only sees the API's fields.
const hidden = (methods: object): PropertyDescriptorMap =>
  Object.fromEntries(
    Reflect.ownKeys(methods).map((key) => {
      const value: unknown = Reflect.get(methods, key);
      return [key, { value, enumerable: false }];
    }),
  );

const fetchPage = async <T>(
  requester: Requester,
  spec: RequestSpec,
  pagination: Pagination,
): Promise<Page<T>> => {
  const body = await requester.request<PageBody<T>>(spec);
  const getNextPage = (): Promise<Page<T>> => {
    if (body.nextCursor === null) {
      return Promise.reject(
        new Error("This is the last page; check hasNextPage() first."),
      );
    }
    const query: QueryParams = {
      ...spec.query,
      [pagination.cursorParam]: positionAfter(
        body.items,
        body.nextCursor,
        pagination.style,
      ),
    };
    return fetchPage<T>(requester, { ...spec, query }, pagination);
  };
  const page: Page<T> = Object.defineProperties(
    body,
    hidden({
      hasNextPage: () => body.nextCursor !== null,
      getNextPage,
      iterPages: async function* () {
        let current = page;
        yield current;
        while (current.hasNextPage()) {
          current = await current.getNextPage();
          yield current;
        }
      },
    }),
  ) as Page<T>;
  return page;
};

export const requestPage = <T>(
  requester: Requester,
  spec: RequestSpec,
  pagination: Pagination,
): PagePromise<T> => {
  const first = fetchPage<T>(requester, spec, pagination);
  const items = async function* () {
    for await (const page of (await first).iterPages()) {
      yield* page.items;
    }
  };
  return Object.defineProperties(
    first,
    hidden({
      [Symbol.asyncIterator]: items,
      autoPagingToArray: async ({ limit }: { readonly limit: number }) => {
        if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ARRAY_LIMIT) {
          throw new TypeError(
            `autoPagingToArray needs a limit from 1 to ${String(MAX_ARRAY_LIMIT)}`,
          );
        }
        const collected: T[] = [];
        for await (const item of items()) {
          collected.push(item);
          if (collected.length === limit) {
            break;
          }
        }
        return collected;
      },
    }),
  ) as PagePromise<T>;
};
