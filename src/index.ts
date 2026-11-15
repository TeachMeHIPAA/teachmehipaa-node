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
export type { ResponseMetadata, WithLastResponse } from "./core/response.js";
export type { AppInfo } from "./core/user-agent.js";
export type { Logger, RequestLogFields } from "./core/logging.js";
export type { RequestOptions } from "./core/request-options.js";
export type {
  LearnerCreateParams,
  LearnerRetrieveParams,
  LearnerUpdateParams,
} from "./resources/learners.js";
export type {
  HttpMethod,
  Transport,
  TransportRequest,
} from "./core/transport.js";
export type {
  Learner,
  LearnerCertificate,
  LearnerCourse,
  LearnerLaunchLink,
  LearnerStatus,
} from "./models/learner.js";
export default TeachMeHipaa;
