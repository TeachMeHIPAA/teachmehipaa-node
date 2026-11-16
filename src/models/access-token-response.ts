// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AccessTokenResponseScopesItem } from "./access-token-response-scopes-item.js";
import type { AccessTokenResponseTokenType } from "./access-token-response-token-type.js";

export interface AccessTokenResponse {
  readonly tokenType: AccessTokenResponseTokenType;
  readonly accessToken: string;
  readonly expiresInSec: number;
  readonly scopes: readonly AccessTokenResponseScopesItem[];
}
