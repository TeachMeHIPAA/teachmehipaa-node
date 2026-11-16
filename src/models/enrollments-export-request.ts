// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { EnrollmentsExportRequestFormat } from "./enrollments-export-request-format.js";

export interface EnrollmentsExportRequest {
  /** The file format. Only `csv` today. */
  readonly format: EnrollmentsExportRequestFormat;
}
