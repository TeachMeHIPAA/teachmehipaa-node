<!-- Generated from openapi/sdk-ir.json by `npm run generate`. Edit the generator, not this file. -->

# Resource reference

13 resources, 45 methods, generated from Developer API release `trimmed-2026-11-15`. Types live in the [TypeDoc site](https://teachmehipaa.github.io/teachmehipaa-node/); usage lives in the [guides](../README.md).

Methods return promises (lists return a `PagePromise` you can `for await`). Arguments go path parameters, then params, then [request options](../guides/errors.md#request-options). Results carry a non-enumerable `lastResponse` with `requestId`, `status` and `etag`. Routes are relative to the Environment's base URL (Live is `https://api.tme.so/v1`; Sandbox is `https://api-teachmehipaa-dev.web.app/v1`); `{orgId}` comes from the client's [Organization binding](../guides/client.md#the-organization-binding).

## Contents

- [`auditEvents`](#auditevents): [`list`](#auditeventslist)
- [`auth`](#auth): [`introspect`](#authintrospect)
- [`certificateVerifications`](#certificateverifications): [`retrieve`](#certificateverificationsretrieve)
- [`certificates`](#certificates): [`downloadPdf`](#certificatesdownloadpdf), [`export`](#certificatesexport), [`list`](#certificateslist), [`retrieve`](#certificatesretrieve), [`retrieveLinks`](#certificatesretrievelinks)
- [`compliance`](#compliance): [`retrieve`](#complianceretrieve)
- [`courses`](#courses): [`list`](#courseslist), [`retrieve`](#coursesretrieve)
- [`enrollments`](#enrollments): [`batch`](#enrollmentsbatch), [`batchByFilter`](#enrollmentsbatchbyfilter), [`cancel`](#enrollmentscancel), [`create`](#enrollmentscreate), [`export`](#enrollmentsexport), [`import`](#enrollmentsimport), [`list`](#enrollmentslist), [`previewImport`](#enrollmentspreviewimport), [`remind`](#enrollmentsremind), [`renew`](#enrollmentsrenew), [`resendInvite`](#enrollmentsresendinvite), [`retrieve`](#enrollmentsretrieve)
- [`events`](#events): [`list`](#eventslist)
- [`learners`](#learners): [`batchUpsert`](#learnersbatchupsert), [`create`](#learnerscreate), [`createLaunchLink`](#learnerscreatelaunchlink), [`export`](#learnersexport), [`list`](#learnerslist), [`offboard`](#learnersoffboard), [`remind`](#learnersremind), [`retrieve`](#learnersretrieve), [`update`](#learnersupdate), [`upsertByExternalId`](#learnersupsertbyexternalid)
- [`members`](#members): [`list`](#memberslist), [`retrieve`](#membersretrieve)
- [`operations`](#operations): [`retrieve`](#operationsretrieve)
- [`seats`](#seats): [`retrieve`](#seatsretrieve)
- [`webhookSubscriptions`](#webhooksubscriptions): [`create`](#webhooksubscriptionscreate), [`delete`](#webhooksubscriptionsdelete), [`list`](#webhooksubscriptionslist), [`redrive`](#webhooksubscriptionsredrive), [`retrieve`](#webhooksubscriptionsretrieve), [`test`](#webhooksubscriptionstest), [`update`](#webhooksubscriptionsupdate)

## Scopes

A token holds its API client's Scopes, or the subset you name in `scopes`. Where a method lists alternatives, one set is enough. See [Scopes](../guides/client.md#scopes).

| Scope               | Allows                                                            |
| ------------------- | ----------------------------------------------------------------- |
| `audit:read`        | Read the organization's audit-event trail and event log.          |
| `certificates:read` | Read certificates and download certificate artifacts.             |
| `compliance:read`   | API clients: read the compliance summary.                         |
| `enrollments:read`  | Read enrollments, invitations, seats, and member sub-resources.   |
| `enrollments:write` | Create and transition enrollments and assessment attempts.        |
| `learners:read`     | API clients: read learners.                                       |
| `learners:write`    | API clients: create and update learners.                          |
| `members:read`      | Read organization members and the organization record.            |
| `webhooks:manage`   | API clients: manage webhook subscriptions and read the event log. |

## `auditEvents`

### `auditEvents.list`

List all audit events

Returns a list of the organization's audit events, newest first. Filter by `type`, `transition`, `subjectId`, or a `since` and `until` range.

```ts
client.auditEvents.list(
  params?: AuditEventListParams,
  options?: RequestOptions,
): PagePromise<AuditEvent>
```

|             |                                           |
| ----------- | ----------------------------------------- |
| HTTP        | `GET /organizations/{orgId}/audit-events` |
| Scopes      | `audit:read`                              |
| Returns     | `PagePromise<AuditEvent>`                 |
| Retries     | Network errors, 409 `conflict`, 429, 5xx  |
| Idempotency | None                                      |

## `auth`

### `auth.introspect`

Retrieve the current token

Describes the access token you call with: whether it belongs to an API client or a person, its organization, its scopes and when it expires. Needs no scope.

```ts
client.auth.introspect(
  options?: RequestOptions,
): Promise<WithLastResponse<TokenIntrospection>>
```

|             |                                                 |
| ----------- | ----------------------------------------------- |
| HTTP        | `GET /auth/introspection`                       |
| Scopes      | Any Access token                                |
| Returns     | `Promise<WithLastResponse<TokenIntrospection>>` |
| Retries     | Network errors, 409 `conflict`, 429, 5xx        |
| Idempotency | None                                            |

## `certificateVerifications`

### `certificateVerifications.retrieve`

Verify a certificate

Verifies the certificate behind a `https://tme.so/{tinyId}` link. Needs no access token. Limited to 60 requests a minute per IP address.

```ts
client.certificateVerifications.retrieve(
  tinyId: string,
  options?: RequestOptions,
): Promise<WithLastResponse<CertificateVerification>>
```

|             |                                                      |
| ----------- | ---------------------------------------------------- |
| HTTP        | `GET /certificate-verifications/{tinyId}`            |
| Scopes      | None (public, no Access token)                       |
| Returns     | `Promise<WithLastResponse<CertificateVerification>>` |
| Retries     | Network errors, 409 `conflict`, 429, 5xx             |
| Idempotency | None                                                 |

## `certificates`

### `certificates.downloadPdf`

Download a certificate

Downloads the certificate as a PDF. Revoked and expired certificates are watermarked. Requires the `certificates:read` scope.

```ts
client.certificates.downloadPdf(
  certId: string,
  options?: DownloadOptions,
): Promise<WithLastResponse<BinaryResponse | BinaryStreamResponse>>
```

|             |                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| HTTP        | `GET /organizations/{orgId}/certificates/{certId}/content`                                               |
| Scopes      | `certificates:read`                                                                                      |
| Returns     | `Promise<WithLastResponse<BinaryResponse \| BinaryStreamResponse>>`                                      |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                                                 |
| Idempotency | None                                                                                                     |
| Notes       | Resolves with the whole file in `data`, or with `asStream: true`, as a web `ReadableStream` in `stream`. |

### `certificates.export`

Export certificates

Exports the organization's certificate records as CSV. Requires the `certificates:read` scope.

```ts
client.certificates.export(
  params: CertificateExportParams,
  options?: RequestOptions,
): Promise<Operation>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/certificates:export`                             |
| Scopes      | `certificates:read`                                                           |
| Returns     | `Promise<Operation>`                                                          |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |
| Notes       | Resolves with an Operation; `await operation.wait()` for its final state.     |

### `certificates.list`

List all certificates

Returns a list of the organization's certificates. Pass `subjectId` to list one learner's.

```ts
client.certificates.list(
  params?: CertificateListParams,
  options?: RequestOptions,
): PagePromise<Certificate>
```

|             |                                           |
| ----------- | ----------------------------------------- |
| HTTP        | `GET /organizations/{orgId}/certificates` |
| Scopes      | `certificates:read`                       |
| Returns     | `PagePromise<Certificate>`                |
| Retries     | Network errors, 409 `conflict`, 429, 5xx  |
| Idempotency | None                                      |

### `certificates.retrieve`

Retrieve a certificate

Retrieves a certificate.

```ts
client.certificates.retrieve(
  certId: string,
  options?: RequestOptions,
): Promise<WithLastResponse<Certificate>>
```

|             |                                                    |
| ----------- | -------------------------------------------------- |
| HTTP        | `GET /organizations/{orgId}/certificates/{certId}` |
| Scopes      | `certificates:read`                                |
| Returns     | `Promise<WithLastResponse<Certificate>>`           |
| Retries     | Network errors, 409 `conflict`, 429, 5xx           |
| Idempotency | None                                               |

### `certificates.retrieveLinks`

Retrieve certificate links

Retrieves the certificate's LinkedIn add-to-profile link and its public `tme.so` verification link. Requires the `certificates:read` scope.

```ts
client.certificates.retrieveLinks(
  certId: string,
  options?: RequestOptions,
): Promise<WithLastResponse<CertificateLinks>>
```

|             |                                                                |
| ----------- | -------------------------------------------------------------- |
| HTTP        | `GET /organizations/{orgId}/certificates/{certId}/credentials` |
| Scopes      | `certificates:read`                                            |
| Returns     | `Promise<WithLastResponse<CertificateLinks>>`                  |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                       |
| Idempotency | None                                                           |

## `compliance`

### `compliance.retrieve`

Retrieve the compliance summary

Counts the organization's learners in one course by status. Removed learners aren't counted.

```ts
client.compliance.retrieve(
  params?: ComplianceRetrieveParams,
  options?: RequestOptions,
): Promise<WithLastResponse<ComplianceSummary>>
```

|             |                                                |
| ----------- | ---------------------------------------------- |
| HTTP        | `GET /organizations/{orgId}/compliance`        |
| Scopes      | `compliance:read`                              |
| Returns     | `Promise<WithLastResponse<ComplianceSummary>>` |
| Retries     | Network errors, 409 `conflict`, 429, 5xx       |
| Idempotency | None                                           |

## `courses`

### `courses.list`

List all courses

Returns a list of the courses in the public catalog. Needs no access token.

```ts
client.courses.list(
  params?: CourseListParams,
  options?: RequestOptions,
): PagePromise<Course>
```

|             |                                          |
| ----------- | ---------------------------------------- |
| HTTP        | `GET /courses`                           |
| Scopes      | None (public, no Access token)           |
| Returns     | `PagePromise<Course>`                    |
| Retries     | Network errors, 409 `conflict`, 429, 5xx |
| Idempotency | None                                     |

### `courses.retrieve`

Retrieve a course

Retrieves a course from the public catalog.

```ts
client.courses.retrieve(
  courseId: string,
  options?: ConditionalReadOptions,
): Promise<WithLastResponse<Course> | NotModified>
```

|             |                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HTTP        | `GET /courses/{courseId}`                                                                                                                              |
| Scopes      | None (public, no Access token)                                                                                                                         |
| Returns     | `Promise<WithLastResponse<Course> \| NotModified>`                                                                                                     |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                                                                                               |
| Idempotency | None                                                                                                                                                   |
| Notes       | Pass the ETag of the copy you hold as `ifNoneMatch` (or the copy itself) to skip the transfer when it's current: the call then resolves `NotModified`. |

## `enrollments`

### `enrollments.batch`

Update many enrollments

Reminds, resends, cancels, renews, archives or unarchives up to 500 enrollments in one request, chosen by id or by filter. Each enrollment succeeds or fails on its own. Requires the `enrollments:write` scope.

```ts
client.enrollments.batch(
  params: EnrollmentBatchParams,
  options?: RequestOptions,
): Promise<WithLastResponse<EnrollmentsBatchResults>>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/enrollments:batch`                               |
| Scopes      | `enrollments:write`                                                           |
| Returns     | `Promise<WithLastResponse<EnrollmentsBatchResults>>`                          |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |

### `enrollments.batchByFilter`

Update many enrollments

Reminds, resends, cancels, renews, archives or unarchives up to 500 enrollments in one request, chosen by id or by filter. Each enrollment succeeds or fails on its own. Requires the `enrollments:write` scope.

```ts
client.enrollments.batchByFilter(
  params: EnrollmentBatchByFilterParams,
  options?: RequestOptions,
): Promise<Operation>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/enrollments:batch`                               |
| Scopes      | `enrollments:write`                                                           |
| Returns     | `Promise<Operation>`                                                          |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |
| Notes       | Resolves with an Operation; `await operation.wait()` for its final state.     |

### `enrollments.cancel`

Cancel an enrollment

Cancels an invite that hasn't been accepted yet and returns its seat to the pool. With `refund: true`, refunds the seat to the card that paid for it instead. The enrollment remains, with status `CANCELLED`. Requires the `enrollments:write` scope.

```ts
client.enrollments.cancel(
  enrollmentId: string,
  params?: EnrollmentCancelParams,
  options?: RequestOptions,
): Promise<WithLastResponse<CancelEnrollmentResponse>>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/enrollments/{enrollmentId}:cancel`               |
| Scopes      | `enrollments:write`                                                           |
| Returns     | `Promise<WithLastResponse<CancelEnrollmentResponse>>`                         |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |

### `enrollments.create`

Create an enrollment

Invites a person to a course, creating their profile if needed, and uses one seat. The course defaults to `hipaa`. Requires the `enrollments:write` scope.

```ts
client.enrollments.create(
  params: EnrollmentCreateParams,
  options?: RequestOptions,
): Promise<WithLastResponse<Enrollment>>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/enrollments`                                     |
| Scopes      | `enrollments:write`                                                           |
| Returns     | `Promise<WithLastResponse<Enrollment>>`                                       |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |

### `enrollments.export`

Export enrollments

Exports the organization's enrollments as CSV. Requires the `enrollments:read` scope.

```ts
client.enrollments.export(
  params: EnrollmentExportParams,
  options?: RequestOptions,
): Promise<Operation>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/enrollments:export`                              |
| Scopes      | `enrollments:read`                                                            |
| Returns     | `Promise<Operation>`                                                          |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |
| Notes       | Resolves with an Operation; `await operation.wait()` for its final state.     |

### `enrollments.import`

Import learners from CSV

Invites everyone in a CSV file with an `email` column (and optional `name` and `courseId`). Send `validateOnly: true` first to preview the file without inviting anyone. Up to 500 rows. Requires the `enrollments:write` scope.

```ts
client.enrollments.import(
  params: EnrollmentImportParams,
  options?: RequestOptions,
): Promise<Operation>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/enrollments:import`                              |
| Scopes      | `enrollments:write`                                                           |
| Returns     | `Promise<Operation>`                                                          |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |
| Notes       | Resolves with an Operation; `await operation.wait()` for its final state.     |

### `enrollments.list`

List all enrollments

Returns a list of the organization's enrollments. Filter by `status`, `courseId` or `archived`. Requires the `enrollments:read` scope.

```ts
client.enrollments.list(
  params?: EnrollmentListParams,
  options?: RequestOptions,
): PagePromise<OrgEnrollmentListItem>
```

|             |                                          |
| ----------- | ---------------------------------------- |
| HTTP        | `GET /organizations/{orgId}/enrollments` |
| Scopes      | `enrollments:read`                       |
| Returns     | `PagePromise<OrgEnrollmentListItem>`     |
| Retries     | Network errors, 409 `conflict`, 429, 5xx |
| Idempotency | None                                     |

### `enrollments.previewImport`

Import learners from CSV

Invites everyone in a CSV file with an `email` column (and optional `name` and `courseId`). Send `validateOnly: true` first to preview the file without inviting anyone. Up to 500 rows. Requires the `enrollments:write` scope.

```ts
client.enrollments.previewImport(
  params: EnrollmentPreviewImportParams,
  options?: RequestOptions,
): Promise<WithLastResponse<ImportPreview>>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/enrollments:import`                              |
| Scopes      | `enrollments:write`                                                           |
| Returns     | `Promise<WithLastResponse<ImportPreview>>`                                    |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |

### `enrollments.remind`

Remind an enrollment

Emails the learner again: the invitation if they haven't joined, or a reminder linking to the training if they have. Requires the `enrollments:write` scope.

```ts
client.enrollments.remind(
  enrollmentId: string,
  options?: RequestOptions,
): Promise<WithLastResponse<EnrollmentActionAccepted>>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/enrollments/{enrollmentId}:remind`               |
| Scopes      | `enrollments:write`                                                           |
| Returns     | `Promise<WithLastResponse<EnrollmentActionAccepted>>`                         |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |

### `enrollments.renew`

Renew an enrollment

Starts the next certification cycle for a certified learner and invites them again, using one seat. Retrying never uses a second seat. Requires the `enrollments:write` scope.

```ts
client.enrollments.renew(
  enrollmentId: string,
  options?: RequestOptions,
): Promise<WithLastResponse<Enrollment>>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/enrollments/{enrollmentId}:renew`                |
| Scopes      | `enrollments:write`                                                           |
| Returns     | `Promise<WithLastResponse<Enrollment>>`                                       |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |

### `enrollments.resendInvite`

Resend an invite

Sends a pending invite again, within the same cycle. To invite a certified learner again, renew the enrollment. Requires the `enrollments:write` scope.

```ts
client.enrollments.resendInvite(
  enrollmentId: string,
  options?: RequestOptions,
): Promise<WithLastResponse<EnrollmentActionAccepted>>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/enrollments/{enrollmentId}:resendInvite`         |
| Scopes      | `enrollments:write`                                                           |
| Returns     | `Promise<WithLastResponse<EnrollmentActionAccepted>>`                         |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |

### `enrollments.retrieve`

Retrieve an enrollment

Retrieves an enrollment. Requires the `enrollments:read` scope.

```ts
client.enrollments.retrieve(
  enrollmentId: string,
  options?: ConditionalReadOptions,
): Promise<WithLastResponse<Enrollment> | NotModified>
```

|             |                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HTTP        | `GET /organizations/{orgId}/enrollments/{enrollmentId}`                                                                                                |
| Scopes      | `enrollments:read`                                                                                                                                     |
| Returns     | `Promise<WithLastResponse<Enrollment> \| NotModified>`                                                                                                 |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                                                                                               |
| Idempotency | None                                                                                                                                                   |
| Notes       | Pass the ETag of the copy you hold as `ifNoneMatch` (or the copy itself) to skip the transfer when it's current: the call then resolves `NotModified`. |

## `events`

Plus `events.tail(params?, options?)`, hand-written over `events.list`: an async iterator over the Event log, oldest first, that tracks its position in `lastEventId` and stops on an `AbortSignal`. See [Tailing the Event log](../guides/pagination.md#tailing-the-event-log).

### `events.list`

List all events

Returns a list of the organization's events from the last 30 days, oldest first. Pass the last `eventId` you processed as `after` to resume where you stopped, and `type` to list one event type.

```ts
client.events.list(
  params?: EventListParams,
  options?: RequestOptions,
): PagePromise<Event>
```

|             |                                          |
| ----------- | ---------------------------------------- |
| HTTP        | `GET /organizations/{orgId}/events`      |
| Scopes      | `webhooks:manage` or `audit:read`        |
| Returns     | `PagePromise<Event>`                     |
| Retries     | Network errors, 409 `conflict`, 429, 5xx |
| Idempotency | None                                     |

## `learners`

### `learners.batchUpsert`

Create many learners

Creates or retrieves up to 500 learners in one request. Each item works like creating one learner and succeeds or fails on its own.

```ts
client.learners.batchUpsert(
  params: LearnerBatchUpsertParams,
  options?: RequestOptions,
): Promise<Operation>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/learners:batchUpsert`                            |
| Scopes      | `learners:write`                                                              |
| Returns     | `Promise<Operation>`                                                          |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |
| Notes       | Resolves with an Operation; `await operation.wait()` for its final state.     |

### `learners.create`

Create a learner

Adds a person to the organization and invites them to a course in one call, using one seat. If the email or `externalId` already belongs to an active learner in the course, nothing is created. With `delivery: "none"`, no email is sent and the response includes a `joinUrl` for you to deliver.

```ts
client.learners.create(
  params: LearnerCreateParams,
  options?: RequestOptions,
): Promise<WithLastResponse<LearnerWriteResult>>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/learners`                                        |
| Scopes      | `learners:write`                                                              |
| Returns     | `Promise<WithLastResponse<LearnerWriteResult>>`                               |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |

### `learners.createLaunchLink`

Create a launch link

Creates a link that opens the course with the learner already signed in, for a "Start training" button in your product. The link works once and expires after 5 minutes: create it when the learner clicks, then redirect them to it. Never email, store or log it. Only for a learner who has accepted their invite.

```ts
client.learners.createLaunchLink(
  learnerId: string,
  params?: LearnerCreateLaunchLinkParams,
  options?: RequestOptions,
): Promise<WithLastResponse<LearnerLaunchLink>>
```

|             |                                                                     |
| ----------- | ------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/learners/{learnerId}:createLaunchLink` |
| Scopes      | `learners:write`                                                    |
| Returns     | `Promise<WithLastResponse<LearnerLaunchLink>>`                      |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                            |
| Idempotency | None                                                                |

### `learners.export`

Export learners

Exports the organization's learners in one course as CSV, optionally only those with one `status`. Requires the `learners:read` scope.

```ts
client.learners.export(
  params: LearnerExportParams,
  options?: RequestOptions,
): Promise<Operation>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/learners:export`                                 |
| Scopes      | `learners:read`                                                               |
| Returns     | `Promise<Operation>`                                                          |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |
| Notes       | Resolves with an Operation; `await operation.wait()` for its final state.     |

### `learners.list`

List all learners

Returns a list of the organization's learners in one course, with each learner's status, dates and current certificate. Filter by `status`, or find one learner by `email` or `externalId`.

```ts
client.learners.list(
  params?: LearnerListParams,
  options?: RequestOptions,
): PagePromise<Learner>
```

|             |                                          |
| ----------- | ---------------------------------------- |
| HTTP        | `GET /organizations/{orgId}/learners`    |
| Scopes      | `learners:read`                          |
| Returns     | `PagePromise<Learner>`                   |
| Retries     | Network errors, 409 `conflict`, 429, 5xx |
| Idempotency | None                                     |

### `learners.offboard`

Offboard a learner

Removes a learner from the organization. A learner who hasn't started has their invite cancelled and the seat returned; a learner who has started keeps their training history and certificates. Releases the learner's `externalId`.

```ts
client.learners.offboard(
  learnerId: string,
  params?: LearnerOffboardParams,
  options?: ConditionalWriteOptions,
): Promise<WithLastResponse<Learner>>
```

|             |                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/learners/{learnerId}:offboard`                                                           |
| Scopes      | `learners:write`                                                                                                      |
| Returns     | `Promise<WithLastResponse<Learner>>`                                                                                  |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                                                              |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it                                         |
| Notes       | Pass `ifMatch` to make the call conditional on the object's ETag; a stale one raises `PreconditionFailedError` (412). |

### `learners.remind`

Remind a learner

Emails the learner a reminder: the invite again if they haven't started, or a nudge to finish if they have.

```ts
client.learners.remind(
  learnerId: string,
  params?: LearnerRemindParams,
  options?: RequestOptions,
): Promise<WithLastResponse<LearnerRemindAccepted>>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/learners/{learnerId}:remind`                     |
| Scopes      | `learners:write`                                                              |
| Returns     | `Promise<WithLastResponse<LearnerRemindAccepted>>`                            |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |

### `learners.retrieve`

Retrieve a learner

Retrieves a learner's status in one course.

```ts
client.learners.retrieve(
  learnerId: string,
  params?: LearnerRetrieveParams,
  options?: RequestOptions,
): Promise<WithLastResponse<Learner>>
```

|             |                                                   |
| ----------- | ------------------------------------------------- |
| HTTP        | `GET /organizations/{orgId}/learners/{learnerId}` |
| Scopes      | `learners:read`                                   |
| Returns     | `Promise<WithLastResponse<Learner>>`              |
| Retries     | Network errors, 409 `conflict`, 429, 5xx          |
| Idempotency | None                                              |

### `learners.update`

Update a learner

Updates a learner's `name` or `externalId`; parameters you don't send are left unchanged. Send the body as `application/merge-patch+json` with the learner's current `ETag` in `If-Match`.

```ts
client.learners.update(
  learnerId: string,
  params: LearnerUpdateParams,
  options: RequiredConditionalWriteOptions,
): Promise<WithLastResponse<Learner>>
```

|             |                                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP        | `PATCH /organizations/{orgId}/learners/{learnerId}`                                                                                                                                                                 |
| Scopes      | `learners:write`                                                                                                                                                                                                    |
| Returns     | `Promise<WithLastResponse<Learner>>`                                                                                                                                                                                |
| Retries     | Never (unsafe to replay)                                                                                                                                                                                            |
| Idempotency | None                                                                                                                                                                                                                |
| Notes       | Pass the object's current ETag as `ifMatch`, such as the object you read: `{ ifMatch: object }`. Without it the API refuses the write with `PreconditionFailedError` (428); with a stale one, the same error (412). |

### `learners.upsertByExternalId`

Create or retrieve a learner by your id

Makes sure a learner exists for your own id. Creates and invites the learner the first time, and returns them on every later call, so a sync job can replay it safely. Never uses a second seat.

```ts
client.learners.upsertByExternalId(
  externalId: string,
  params: LearnerUpsertByExternalIdParams,
  options?: RequestOptions,
): Promise<WithLastResponse<LearnerWriteResult>>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `PUT /organizations/{orgId}/learners/by-external-id/{externalId}`             |
| Scopes      | `learners:write`                                                              |
| Returns     | `Promise<WithLastResponse<LearnerWriteResult>>`                               |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |

## `members`

### `members.list`

List all members

Returns a list of the organization's members, its admins and learners. Pass `role=admin` to list only admins.

```ts
client.members.list(
  params?: MemberListParams,
  options?: RequestOptions,
): PagePromise<MemberListItem>
```

|             |                                          |
| ----------- | ---------------------------------------- |
| HTTP        | `GET /organizations/{orgId}/members`     |
| Scopes      | `members:read`                           |
| Returns     | `PagePromise<MemberListItem>`            |
| Retries     | Network errors, 409 `conflict`, 429, 5xx |
| Idempotency | None                                     |

### `members.retrieve`

Retrieve a member

Retrieves a member of the organization.

```ts
client.members.retrieve(
  subjectId: string,
  options?: RequestOptions,
): Promise<WithLastResponse<Member>>
```

|             |                                                  |
| ----------- | ------------------------------------------------ |
| HTTP        | `GET /organizations/{orgId}/members/{subjectId}` |
| Scopes      | `members:read`                                   |
| Returns     | `Promise<WithLastResponse<Member>>`              |
| Retries     | Network errors, 409 `conflict`, 429, 5xx         |
| Idempotency | None                                             |

## `operations`

### `operations.retrieve`

Retrieve an operation

Retrieves a bulk operation and its result. Operations are kept for 24 hours.

```ts
client.operations.retrieve(
  operationId: string,
  options?: RequestOptions,
): Promise<Operation>
```

|             |                                                                           |
| ----------- | ------------------------------------------------------------------------- |
| HTTP        | `GET /organizations/{orgId}/operations/{operationId}`                     |
| Scopes      | Any Access token                                                          |
| Returns     | `Promise<Operation>`                                                      |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                  |
| Idempotency | None                                                                      |
| Notes       | Resolves with an Operation; `await operation.wait()` for its final state. |

## `seats`

### `seats.retrieve`

Retrieve the seat inventory

Retrieves how many seats the organization has, how many are assigned and how many are available for new invites. Requires the `enrollments:read` scope.

```ts
client.seats.retrieve(
  options?: RequestOptions,
): Promise<WithLastResponse<SeatsInventory>>
```

|             |                                             |
| ----------- | ------------------------------------------- |
| HTTP        | `GET /organizations/{orgId}/seats`          |
| Scopes      | `enrollments:read`                          |
| Returns     | `Promise<WithLastResponse<SeatsInventory>>` |
| Retries     | Network errors, 409 `conflict`, 429, 5xx    |
| Idempotency | None                                        |

## `webhookSubscriptions`

### `webhookSubscriptions.create`

Create a webhook subscription

Subscribes an HTTPS endpoint to event types and creates its signing secret. Requires the `webhooks:manage` or `org:admin` scope.

```ts
client.webhookSubscriptions.create(
  params: WebhookSubscriptionCreateParams,
  options?: RequestOptions,
): Promise<WithLastResponse<WebhookSubscriptionCreated>>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/webhook-subscriptions`                           |
| Scopes      | `org:admin` or `webhooks:manage`                                              |
| Returns     | `Promise<WithLastResponse<WebhookSubscriptionCreated>>`                       |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |

### `webhookSubscriptions.delete`

Delete a webhook subscription

Deletes a webhook subscription and its signing secret. Requires the `webhooks:manage` or `org:admin` scope.

```ts
client.webhookSubscriptions.delete(
  subscriptionId: string,
  options?: RequestOptions,
): Promise<EmptyResponse>
```

|             |                                                                        |
| ----------- | ---------------------------------------------------------------------- |
| HTTP        | `DELETE /organizations/{orgId}/webhook-subscriptions/{subscriptionId}` |
| Scopes      | `org:admin` or `webhooks:manage`                                       |
| Returns     | `Promise<EmptyResponse>`                                               |
| Retries     | Never (unsafe to replay)                                               |
| Idempotency | None                                                                   |

### `webhookSubscriptions.list`

List all webhook subscriptions

Returns a list of the organization's webhook subscriptions. Signing secrets are never returned. Requires the `webhooks:manage` or `org:admin` scope.

```ts
client.webhookSubscriptions.list(
  params?: WebhookSubscriptionListParams,
  options?: RequestOptions,
): PagePromise<WebhookSubscription>
```

|             |                                                    |
| ----------- | -------------------------------------------------- |
| HTTP        | `GET /organizations/{orgId}/webhook-subscriptions` |
| Scopes      | `org:admin` or `webhooks:manage`                   |
| Returns     | `PagePromise<WebhookSubscription>`                 |
| Retries     | Network errors, 409 `conflict`, 429, 5xx           |
| Idempotency | None                                               |

### `webhookSubscriptions.redrive`

Retry failed deliveries

Delivers the subscription's failed events again. Requires the `webhooks:manage` or `org:admin` scope.

```ts
client.webhookSubscriptions.redrive(
  subscriptionId: string,
  options?: RequestOptions,
): Promise<Operation<WebhookDeliveryResult>>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/webhook-subscriptions/{subscriptionId}:redrive`  |
| Scopes      | `org:admin` or `webhooks:manage`                                              |
| Returns     | `Promise<Operation<WebhookDeliveryResult>>`                                   |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |
| Notes       | Resolves with an Operation; `await operation.wait()` for its final state.     |

### `webhookSubscriptions.retrieve`

Retrieve a webhook subscription

Retrieves a webhook subscription. Requires the `webhooks:manage` or `org:admin` scope.

```ts
client.webhookSubscriptions.retrieve(
  subscriptionId: string,
  options?: ConditionalReadOptions,
): Promise<WithLastResponse<WebhookSubscription> | NotModified>
```

|             |                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HTTP        | `GET /organizations/{orgId}/webhook-subscriptions/{subscriptionId}`                                                                                    |
| Scopes      | `org:admin` or `webhooks:manage`                                                                                                                       |
| Returns     | `Promise<WithLastResponse<WebhookSubscription> \| NotModified>`                                                                                        |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                                                                                               |
| Idempotency | None                                                                                                                                                   |
| Notes       | Pass the ETag of the copy you hold as `ifNoneMatch` (or the copy itself) to skip the transfer when it's current: the call then resolves `NotModified`. |

### `webhookSubscriptions.test`

Send a test event

Sends a signed test delivery to the subscription's endpoint, so you can check your verifier. Requires the `webhooks:manage` or `org:admin` scope.

```ts
client.webhookSubscriptions.test(
  subscriptionId: string,
  options?: RequestOptions,
): Promise<Operation<WebhookDeliveryResult>>
```

|             |                                                                               |
| ----------- | ----------------------------------------------------------------------------- |
| HTTP        | `POST /organizations/{orgId}/webhook-subscriptions/{subscriptionId}:test`     |
| Scopes      | `org:admin` or `webhooks:manage`                                              |
| Returns     | `Promise<Operation<WebhookDeliveryResult>>`                                   |
| Retries     | Network errors, 409 `conflict`, 429, 5xx                                      |
| Idempotency | Generated `Idempotency-Key`, reused on retries; `idempotencyKey` overrides it |
| Notes       | Resolves with an Operation; `await operation.wait()` for its final state.     |

### `webhookSubscriptions.update`

Update a webhook subscription

Updates a webhook subscription; parameters you don't send are left unchanged. Send its current `ETag` in `If-Match`. The signing secret doesn't change. Requires the `webhooks:manage` or `org:admin` scope.

```ts
client.webhookSubscriptions.update(
  subscriptionId: string,
  params: WebhookSubscriptionUpdateParams,
  options: RequiredConditionalWriteOptions,
): Promise<WithLastResponse<WebhookSubscription>>
```

|             |                                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP        | `PATCH /organizations/{orgId}/webhook-subscriptions/{subscriptionId}`                                                                                                                                               |
| Scopes      | `org:admin` or `webhooks:manage`                                                                                                                                                                                    |
| Returns     | `Promise<WithLastResponse<WebhookSubscription>>`                                                                                                                                                                    |
| Retries     | Never (unsafe to replay)                                                                                                                                                                                            |
| Idempotency | None                                                                                                                                                                                                                |
| Notes       | Pass the object's current ETag as `ifMatch`, such as the object you read: `{ ifMatch: object }`. Without it the API refuses the write with `PreconditionFailedError` (428); with a stale one, the same error (412). |
