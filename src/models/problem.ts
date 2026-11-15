// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { ProblemCode } from "./problem-code.js";
import type { ProblemErrorsItem } from "./problem-errors-item.js";

export interface Problem {
  /** A URI identifying the problem type. */
  readonly type?: string;
  /** A short summary of the problem. */
  readonly title: string;
  /** The HTTP status code. */
  readonly status: number;
  /** An explanation of this occurrence. */
  readonly detail?: string;
  /** Identifies this occurrence. */
  readonly instance?: string;
  /** A machine-readable error code, such as `seat_unavailable`. */
  readonly code: ProblemCode;
  /** Each invalid field, with its `path` and `message`. */
  readonly errors?: readonly ProblemErrorsItem[];
}
