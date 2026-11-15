// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

export interface Course {
  /** Unique identifier for the course. */
  readonly courseId: string;
  /** The course's title. */
  readonly title: string;
  /** The current version of the course content. */
  readonly courseVersion: string;
  /** The score needed to pass the course's assessment. */
  readonly passingThreshold: number;
}
