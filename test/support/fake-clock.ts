import type { Clock } from "../../src/index.js";

export interface FakeClock extends Clock {
  advance(milliseconds: number): void;
  /** Every duration the client slept for, in order. */
  readonly sleeps: readonly number[];
}

export const createFakeClock = (
  start = Date.UTC(2026, 10, 15, 12),
): FakeClock => {
  let current = start;
  const sleeps: number[] = [];
  return {
    now: () => current,
    sleep: (milliseconds) => {
      sleeps.push(milliseconds);
      current += milliseconds;
      return Promise.resolve();
    },
    advance: (milliseconds) => {
      current += milliseconds;
    },
    sleeps,
  };
};
