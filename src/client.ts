import { resolveConfig, type ClientOptions } from "./core/config.js";
import { errors } from "./core/errors.js";
import { createRequester } from "./core/requester.js";
import { webhooks } from "./core/webhooks.js";
import { clientCredentialsTokenProvider } from "./core/token-provider.js";
import { ApiResources } from "./resources/api-resources.js";

export type TeachMeHipaaOptions = ClientOptions;

// Built before `super()`, because the resources take the requester.
const createClientRequester = (options: TeachMeHipaaOptions) => {
  const config = resolveConfig(options);
  const tokenProvider = clientCredentialsTokenProvider({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    scopes: config.scopes,
    tokenUrl: `${config.baseUrl}/auth/token`,
    userAgent: config.userAgent,
    transport: config.transport,
    timeout: config.timeout,
    maxRetries: config.maxRetries,
    clock: config.clock,
  });
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
 * A client for one API client's credentials and one Organization. Its
 * configuration is fixed at construction; create another client to change it.
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
