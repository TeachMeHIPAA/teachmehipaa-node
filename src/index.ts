import { TeachMeHipaa } from "./client.js";

export { TeachMeHipaa };
export {
  ApiError,
  AuthenticationError,
  ConflictError,
  ConnectionError,
  IdempotencyError,
  InvalidRequestError,
  NotFoundError,
  OAuthError,
  PermissionDeniedError,
  PreconditionFailedError,
  RateLimitError,
  TeachMeHipaaError,
  TimeoutError,
} from "./core/errors.js";
export type { FieldError } from "./core/errors.js";
export type { TeachMeHipaaOptions } from "./client.js";
export type { Environment } from "./core/config.js";
export type { Clock } from "./core/clock.js";
export type { AppInfo } from "./core/user-agent.js";
export type { Logger, RequestLogFields } from "./core/logging.js";
export type { RequestOptions } from "./core/request-options.js";
export type {
  BinaryResponse,
  EmptyResponse,
  ResponseMetadata,
  WithLastResponse,
} from "./core/response.js";
export type { Page, PagePromise } from "./core/pagination.js";
export type { Uploadable } from "./core/uploads.js";
export type * from "./models/index.js";
export type * from "./resources/index.js";
export type {
  HttpMethod,
  Transport,
  TransportRequest,
} from "./core/transport.js";
export default TeachMeHipaa;
