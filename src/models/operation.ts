// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { Problem } from "./problem.js";

export interface Operation {
  /** Unique identifier for the operation. */
  readonly name: string;
  /** Whether the operation has finished. */
  readonly done: boolean;
  /** Progress information, if any. */
  readonly metadata?: Readonly<Record<string, unknown>>;
  /** The result, once `done` is `true`. */
  readonly response?: unknown;
  /** The problem, if the operation failed. */
  readonly error?: Problem;
}
