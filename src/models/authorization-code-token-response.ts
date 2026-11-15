// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuthorizationCodeTokenResponseTokenType } from "./authorization-code-token-response-token-type.js";

export interface AuthorizationCodeTokenResponse {
  readonly access_token: string;
  readonly token_type: AuthorizationCodeTokenResponseTokenType;
  readonly expires_in: number;
  readonly refresh_token: string;
  readonly scope: string;
}
