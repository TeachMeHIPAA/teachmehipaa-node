// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

export interface EnrollmentCreateRequest {
  /** The learner's email address. */
  readonly email: string;
  /** The learner's full name. */
  readonly name?: string;
  /** The course to invite them to. Defaults to `hipaa`. */
  readonly courseId?: string;
}
