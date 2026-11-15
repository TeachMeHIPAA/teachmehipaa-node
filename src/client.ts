import { resolveConfig, type ClientOptions } from "./core/config.js";
import { createRequester } from "./core/requester.js";
import { clientCredentialsTokenProvider } from "./core/token-provider.js";
import { Learners } from "./resources/learners.js";

export type TeachMeHipaaOptions = ClientOptions;

/**
 * A client for one API client's credentials and one Organization. Its
 * configuration is fixed at construction; create another client to change it.
 */
export class TeachMeHipaa {
  readonly learners: Learners;

  constructor(options: TeachMeHipaaOptions) {
    const config = resolveConfig(options);
    const tokenProvider = clientCredentialsTokenProvider({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      scopes: config.scopes,
      tokenUrl: `${config.baseUrl}/auth/token`,
      userAgent: config.userAgent,
      transport: config.transport,
      timeout: config.timeout,
      clock: config.clock,
    });
    const requester = createRequester({
      baseUrl: config.baseUrl,
      userAgent: config.userAgent,
      transport: config.transport,
      tokenProvider,
      timeout: config.timeout,
      organizationId: config.organizationId,
    });
    this.learners = new Learners(requester);
  }
}
