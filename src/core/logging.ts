import type { Clock } from "./clock.js";
import type { Transport } from "./transport.js";

/** The only fields the library ever logs (ADR-0007). */
export interface RequestLogFields {
  readonly method: string;
  /** The URL path without its query, which can carry Learner emails. */
  readonly path: string;
  readonly status: number;
  readonly latencyMs: number;
  readonly requestId: string | null;
}

/** Receives one entry per HTTP response. `console` fits. */
export interface Logger {
  debug(message: string, fields: RequestLogFields): void;
}

// Logging wraps the transport so token mints are logged the same way as API
// calls, and so nothing above it can leak headers or bodies into a log.
export const withRequestLogging = (
  transport: Transport,
  logger: Logger,
  clock: Clock,
): Transport => {
  return async (request) => {
    const startedAt = clock.now();
    const response = await transport(request);
    logger.debug("teachmehipaa request", {
      method: request.method,
      path: new URL(request.url).pathname,
      status: response.status,
      latencyMs: clock.now() - startedAt,
      requestId: response.headers.get("x-request-id"),
    });
    return response;
  };
};
