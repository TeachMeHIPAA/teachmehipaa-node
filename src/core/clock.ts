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
