// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { Course } from "./course.js";

export interface CoursesPage {
  readonly items: readonly Course[];
  readonly nextCursor: string | null;
}
