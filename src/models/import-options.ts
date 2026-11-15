// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

export interface ImportOptions {
  /** The course to invite everyone to. Defaults to the organization's default course. */
  readonly courseId?: string;
  /** Check the file and return a preview without inviting anyone. */
  readonly validateOnly?: boolean;
}
