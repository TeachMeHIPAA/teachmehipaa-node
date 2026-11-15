import type { Clock } from "./clock.js";
import {
  ConnectionError,
  RateLimitError,
  type TeachMeHipaaError,
} from "./errors.js";
import { retryAfterSeconds } from "./problem.js";

const INITIAL_DELAY_MS = 500;
const MAX_DELAY_MS = 5_000;
const MAX_RETRY_AFTER_MS = 60_000;

/** One try at a request: a value, or the error to retry on or raise. */
export type Attempt<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: TeachMeHipaaError };

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly clock: Clock;
  /** Milliseconds to wait before retry `retryNumber`, or `null` to give up. */
  readonly delayBeforeRetry: (
    error: TeachMeHipaaError,
    retryNumber: number,
  ) => number | null;
}

/**
 * Milliseconds before try `attempt` (from 1) after the first: the ceiling
 * doubles from `initial` up to `cap`, and jitter picks 50–100 % of it so
 * that many clients don't retry in step. Nothing waits less than `initial`.
 */
export const jitteredBackoff = (
  initial: number,
  cap: number,
  attempt: number,
): number => {
  const ceiling = Math.min(initial * 2 ** (attempt - 1), cap);
  return Math.max(initial, Math.round(ceiling * (0.5 + Math.random() * 0.5)));
};

/**
 * Honors `Retry-After` up to 60 s, otherwise backs off exponentially on
 * Stripe's schedule, from 0.5 s to 5 s.
 */
export const serverDelay = (
  error: TeachMeHipaaError,
  retryNumber: number,
  now: number,
): number => {
  // A 429 already read the header; a 503 may carry one too.
  const retryAfter =
    error instanceof RateLimitError
      ? error.retryAfter
      : retryAfterSeconds(error.headers["retry-after"], now);
  return retryAfter === null
    ? jitteredBackoff(INITIAL_DELAY_MS, MAX_DELAY_MS, retryNumber)
    : Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS);
};

/** Failures that leave no trace on the server, or that it asks us to retry. */
export const isTransient = (error: TeachMeHipaaError): boolean =>
  error instanceof ConnectionError ||
  error.status === 429 ||
  (error.status === 409 && error.code === "conflict") ||
  (error.status !== null && error.status >= 500);

/**
 * Runs `attempt` until it succeeds or the policy gives up, then raises the
 * last error. A rejected `attempt` (such as a failed token mint) is never
 * retried here; it rejects the caller's promise as it is.
 */
export const withRetries = async <T>(
  attempt: () => Promise<Attempt<T>>,
  policy: RetryPolicy,
): Promise<T> => {
  const run = async (retryNumber: number): Promise<T> => {
    const outcome = await attempt();
    if (outcome.ok) {
      return outcome.value;
    }
    const delay =
      retryNumber > policy.maxRetries
        ? null
        : policy.delayBeforeRetry(outcome.error, retryNumber);
    if (delay === null) {
      throw outcome.error;
    }
    await policy.clock.sleep(delay);
    return run(retryNumber + 1);
  };
  return run(1);
};
