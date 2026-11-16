// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { ImportPreviewRowsItemStatus } from "./import-preview-rows-item-status.js";

export interface ImportPreviewRowsItem {
  readonly rowNumber: number;
  readonly email: string;
  readonly name?: string;
  readonly courseId: string;
  readonly status: ImportPreviewRowsItemStatus;
  readonly detail?: string;
}
