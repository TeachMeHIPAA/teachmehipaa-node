// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

export interface LearnerLaunchLink {
  /** The single-use sign-in URL. Redirect the learner to it right away. */
  readonly url: string;
  /**
   * When the URL stops working, 5 minutes after it was created.
   *
   * An ISO 8601 date-time string.
   */
  readonly expiresAt: string;
}
