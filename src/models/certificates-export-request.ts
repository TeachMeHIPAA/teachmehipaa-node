// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { CertificatesExportRequestFormat } from "./certificates-export-request-format.js";

export interface CertificatesExportRequest {
  /** The file format. Only `csv` today. */
  readonly format: CertificatesExportRequestFormat;
}
