// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { Learner } from "./learner.js";

export interface LearnersPage {
  readonly items: readonly Learner[];
  readonly nextCursor: string | null;
}
