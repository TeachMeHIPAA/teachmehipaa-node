// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { ClientCredentialsTokenResponseTokenType } from "./client-credentials-token-response-token-type.js";

export interface ClientCredentialsTokenResponse {
  /** The access token. Send it as `Authorization: Bearer`. */
  readonly access_token: string;
  /** Always `Bearer`. */
  readonly token_type: ClientCredentialsTokenResponseTokenType;
  /** Seconds until the token expires. */
  readonly expires_in: number;
  /** The scopes the token holds, space-delimited. */
  readonly scope: string;
}
