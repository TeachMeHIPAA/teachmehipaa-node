# Changelog

All notable changes to this library are documented here. It follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[semantic versioning](https://semver.org/).

## [Unreleased]

The first release, to ship as 1.0.0 when the Developer API launches.
Generated from the Developer API document release `waggish-wombat`.

### Added

- `TeachMeHipaa` client for all 56 Developer API operations, as resources and
  typed models generated from the shared SDK IR: Learners, Enrollments,
  Certificates, Certificate verifications, Compliance, Courses, Members,
  Seats, Seat orders, the payment method, Audit events, Webhook
  subscriptions, the Event log, Operations, `auth.introspect` and Partners.
- Client credentials authentication with cached, single-flight Access tokens
  renewed 60 s before expiry, and one renewal and replay on a 401.
- Live and Sandbox Environments, a `baseUrl` override, narrower `scopes`, and
  `staticTokenProvider` for Access tokens obtained elsewhere. Public
  methods (`courses.*`, `certificateVerifications.retrieve`) send no token.
- The Organization binding: discovered once through `auth.introspect`, or
  given as `organizationId`.
- Typed errors by status (`InvalidRequestError`, `AuthenticationError`,
  `PermissionDeniedError`, `NotFoundError`, `ConflictError`,
  `PreconditionFailedError`, `IdempotencyError`, `RateLimitError`,
  `ApiError`, `ConnectionError`, `TimeoutError`, `OAuthError`) carrying the
  problem `code`, `detail`, field errors and `requestId`, with a guard that
  raises `ApiError` for non-JSON responses, including a 2xx with a non-JSON
  body where no content is expected. Mistakes in calling the library raise
  a `TypeError` whose message starts `teachmehipaa:`.
- Retries with exponential backoff and jitter for network errors, 409
  `conflict`, 429 and 5xx, honoring `Retry-After`, only for calls that are
  safe to replay; a generated `Idempotency-Key` per create and custom method,
  reused across retries and overridable per call.
- Per-request options: `idempotencyKey`, `maxRetries`, `timeout`,
  `requestId`, `ifMatch`, `ifNoneMatch` and `asStream`.
- `lastResponse` on every returned object, with status, headers, request id
  and ETag.
- Auto-paging lists: await the first page, `for await` every item,
  `autoPagingToArray`, `hasNextPage` and `getNextPage`.
- Conditional writes and reads with ETags, and merge-patch updates that tell
  an omitted field from one set to `null`. `ifMatch` is required on
  `learners.update` and `webhookSubscriptions.update`, which the API refuses
  without it.
- Operations with `wait()` and `exportResult()` for export CSVs. Test
  delivery and redrive results are typed by `_tag`, with
  `UnknownWebhookDeliveryResult` for tags added later.
- Enrollment CSV imports from a file path, bytes, a `Blob` or a stream, and
  Certificate PDF downloads as bytes or a stream.
- `webhooks.constructEvent`, which verifies a Delivery's signature, body hash,
  path and timestamp and returns a typed Event, `UnknownEvent` or Test
  delivery; and `webhooks.generateTestHeaders` for testing handlers.
- Partner apps: `TeachMeHipaa.oauth` (PKCE pair, state, consent URL, code
  exchange) and `partnerGrantTokenProvider`, which saves every rotated
  Refresh token to your `TokenStore` before use and never retries a Refresh
  token exchange. The provider exposes its resolved `baseUrl`, and the client
  throws a `TypeError` at construction when a provider's `baseUrl` differs
  from its own, so a Grant never refreshes against another Environment.
- `events.tail` to read the Event log from a saved position, once or
  following new Events.
- Opt-in request logging without bodies or credentials, a `User-Agent` with
  your `appInfo`, and a pluggable `fetch` or `transport`.
- ESM and CommonJS builds with TypeScript declarations, for Node.js 20 and
  newer, Bun and Deno. No runtime dependencies and no telemetry.
