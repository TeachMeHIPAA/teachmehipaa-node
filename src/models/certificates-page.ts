// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { Certificate } from "./certificate.js";

export interface CertificatesPage {
  readonly items: readonly Certificate[];
  readonly nextCursor: string | null;
}
