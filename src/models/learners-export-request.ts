// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { LearnerStatus } from "./learner-status.js";
import type { LearnersExportRequestFormat } from "./learners-export-request-format.js";

export interface LearnersExportRequest {
  /** The file format. Only `csv` today. */
  readonly format: LearnersExportRequestFormat;
  /** The course to export. Defaults to the organization's default course. */
  readonly courseId?: string;
  /** Only export learners with this status. */
  readonly status?: LearnerStatus;
}
