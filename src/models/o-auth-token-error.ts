// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { OAuthErrorCode } from "./o-auth-error-code.js";

export interface OAuthTokenError {
  readonly error: OAuthErrorCode;
  readonly error_description?: string;
}
