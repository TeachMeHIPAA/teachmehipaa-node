// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/** Sent as a JSON merge patch: omit a field to leave it unchanged; `null` clears a nullable field. */
export interface LearnerPatch {
  /** The learner's full name. */
  readonly name?: string;
  /** Your own id for the learner. Set it to `null` to clear it. */
  readonly externalId?: string | null;
}
