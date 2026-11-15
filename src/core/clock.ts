/** Time as the client sees it. Inject one to make expiry and backoff testable. */
export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
  sleep(milliseconds: number): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

/**
 * Sleeps on the clock, but wakes as soon as `signal` aborts. `Clock.sleep`
 * can't be cancelled, so this races it against the abort.
 */
export const pause = (
  clock: Clock,
  milliseconds: number,
  signal: AbortSignal | undefined,
): Promise<void> =>
  new Promise((resolve) => {
    const done = () => {
      signal?.removeEventListener("abort", done);
      resolve();
    };
    signal?.addEventListener("abort", done, { once: true });
    void clock.sleep(milliseconds).then(done);
  });
