// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { TokenIntrospectionActorType } from "./token-introspection-actor-type.js";
import type { TokenIntrospectionMode } from "./token-introspection-mode.js";
import type { TokenIntrospectionScopesItem } from "./token-introspection-scopes-item.js";

export interface TokenIntrospection {
  /** `client` for an API client, `user` for a person. */
  readonly actorType: TokenIntrospectionActorType;
  /** The API client the token belongs to. */
  readonly clientId: string | null;
  /** The person the token belongs to, for a user token. */
  readonly subjectId: string | null;
  /** The organization the token is bound to, if any. */
  readonly orgId: string | null;
  /** The scopes the token holds. */
  readonly scopes: readonly TokenIntrospectionScopesItem[];
  /** `test` for a Sandbox client, `live` otherwise. */
  readonly mode: TokenIntrospectionMode | null;
  /** When the token expires (ISO 8601). */
  readonly expiresAt: string | null;
}
