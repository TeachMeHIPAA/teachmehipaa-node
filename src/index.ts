import { TeachMeHipaa } from "./client.js";

export { TeachMeHipaa };
export { webhooks } from "./core/webhooks.js";
export { oauth } from "./core/oauth.js";
export { partnerGrantTokenProvider } from "./core/partner-grant.js";
export { staticTokenProvider } from "./core/token-provider.js";
export { operationIdFromName } from "./core/operations.js";
export {
  ApiError,
  AuthenticationError,
  ConflictError,
  ConnectionError,
  IdempotencyError,
  InvalidRequestError,
  NotFoundError,
  OAuthError,
  OperationFailedError,
  OperationTimeoutError,
  PermissionDeniedError,
  PreconditionFailedError,
  RateLimitError,
  TeachMeHipaaError,
  TimeoutError,
  WebhookSignatureError,
} from "./core/errors.js";
export type { FieldError, WebhookSignatureErrorCode } from "./core/errors.js";
export type { TeachMeHipaaOptions } from "./client.js";
export type {
  ConstructEventOptions,
  GenerateTestHeadersParams,
  WebhookHeaders,
  Webhooks,
} from "./core/webhooks.js";
export type {
  ClientCredentialsOptions,
  Environment,
  PublicClientOptions,
  TokenEndpointOptions,
  TokenProviderOptions,
} from "./core/config.js";
export type { TokenProvider } from "./core/token-provider.js";
export type {
  PartnerGrantOptions,
  PartnerGrantTokenProvider,
  TokenStore,
} from "./core/partner-grant.js";
export type {
  AuthorizeUrlParams,
  ExchangeCodeParams,
  PkcePair,
} from "./core/oauth.js";
export type { GrantTokens } from "./core/grant-exchange.js";
export type { Clock } from "./core/clock.js";
export type { AppInfo } from "./core/user-agent.js";
export type { Logger, RequestLogFields } from "./core/logging.js";
export type {
  ConditionalReadOptions,
  ConditionalWriteOptions,
  DownloadOptions,
  ETagSource,
  RequestOptions,
  RequiredConditionalWriteOptions,
} from "./core/request-options.js";
export type {
  BinaryResponse,
  BinaryStreamResponse,
  EmptyResponse,
  NotModified,
  ResponseMetadata,
  WithLastResponse,
} from "./core/response.js";
export type { Page, PagePromise } from "./core/pagination.js";
export type { EventTail, EventTailParams } from "./extensions/events.js";
export type { Uploadable } from "./core/uploads.js";
// `Operation` here, the model plus `wait()` and `exportResult()`, shadows the
// generated model of the same name in the export below.
export type {
  ExportResult,
  Operation,
  OperationWaitOptions,
  UnknownWebhookDeliveryResult,
  WebhookDeliveryResult,
} from "./core/operations.js";
export type * from "./models/index.js";
export type * from "./resources/index.js";
export type {
  HttpMethod,
  Transport,
  TransportRequest,
} from "./core/transport.js";
export default TeachMeHipaa;
