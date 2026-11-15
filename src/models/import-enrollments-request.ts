// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { Uploadable } from "../core/uploads.js";
import type { ImportOptions } from "./import-options.js";

export interface ImportEnrollmentsRequest {
  /** UTF-8 CSV (RFC 4180: quoted fields, `""` escapes, CRLF/LF). Header row required. */
  readonly file: Uploadable;
  readonly options?: ImportOptions;
}
