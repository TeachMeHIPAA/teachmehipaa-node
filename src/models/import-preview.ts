// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { ImportPreviewRowsItem } from "./import-preview-rows-item.js";

export interface ImportPreview {
  /** Rows in the file. */
  readonly totalRows: number;
  /** Rows that would be invited. */
  readonly validRows: number;
  /** Seats the import would use. */
  readonly seatsRequired: number;
  /** Seats available now. */
  readonly seatsAvailable: number;
  /** Each row's result: `valid`, `invalid_email`, `duplicate_in_file`, `already_enrolled` or `already_invited`. */
  readonly rows: readonly ImportPreviewRowsItem[];
}
