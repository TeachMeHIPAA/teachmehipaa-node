import type { Requester, RequestSpec } from "./requester.js";
import type { WithLastResponse } from "./response.js";

/** One page of a list. Pass `nextCursor` back to get the next one. */
export type Page<T> = WithLastResponse<{
  readonly items: readonly T[];
  /** `null` on the last page. */
  readonly nextCursor: string | null;
}>;

/** What a list method returns: the first page, once awaited. */
export type PagePromise<T> = Promise<Page<T>>;

export const requestPage = <T>(
  requester: Requester,
  spec: RequestSpec,
): PagePromise<T> =>
  requester.request<{ items: readonly T[]; nextCursor: string | null }>(spec);
