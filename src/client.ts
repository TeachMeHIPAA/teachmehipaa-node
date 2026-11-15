import {
  resolveConfig,
  type ClientOptions,
  type ResolvedConfig,
} from "./core/config.js";
import { errors } from "./core/errors.js";
import { createRequester } from "./core/requester.js";
import { webhooks } from "./core/webhooks.js";
import {
  clientCredentialsTokenProvider,
  type TokenProvider,
} from "./core/token-provider.js";
import { ApiResources } from "./resources/api-resources.js";

export type TeachMeHipaaOptions = ClientOptions;

const tokenProviderFor = (
  config: ResolvedConfig,
): TokenProvider | undefined => {
  const { auth } = config;
  switch (auth.kind) {
    case "none":
      return undefined;
    case "tokenProvider":
      return auth.tokenProvider;
    case "clientCredentials":
      return clientCredentialsTokenProvider({
        clientId: auth.clientId,
        clientSecret: auth.clientSecret,
        scopes: auth.scopes,
        tokenUrl: `${config.baseUrl}/auth/token`,
        userAgent: config.userAgent,
        transport: config.transport,
        timeout: config.timeout,
        maxRetries: config.maxRetries,
        clock: config.clock,
      });
  }
};

// Built before `super()`, because the resources take the requester.
const createClientRequester = (options: TeachMeHipaaOptions) => {
  const config = resolveConfig(options);
  const tokenProvider = tokenProviderFor(config);
  return createRequester({
    baseUrl: config.baseUrl,
    userAgent: config.userAgent,
    transport: config.transport,
    tokenProvider,
    timeout: config.timeout,
    maxRetries: config.maxRetries,
    organizationId: config.organizationId,
    clock: config.clock,
  });
};

/**
 * A client for one set of credentials (an API client's, or Access tokens from
 * a token provider) and one Organization, or for public lookups with no
 * credentials at all. Its configuration is fixed at construction; create
 * another client to change it.
 */
export class TeachMeHipaa extends ApiResources {
  /** Every error class, for `instanceof` checks without extra imports. */
  static readonly errors = errors;
  /**
   * Delivery verification, which needs only the Signing secret. Handlers
   * that hold no API credentials can use this or the `webhooks` export.
   */
  static readonly webhooks = webhooks;
  /** The same as `TeachMeHipaa.webhooks`. */
  readonly webhooks = webhooks;

  constructor(options: TeachMeHipaaOptions) {
    super(createClientRequester(options));
  }
}
