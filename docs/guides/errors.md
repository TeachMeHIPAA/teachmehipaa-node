# Errors and retries

Samples use the `client` from [The client](client.md).

```ts sample=errors
import { NotFoundError, TeachMeHipaaError } from "teachmehipaa";

try {
  await client.learners.retrieve("sub_01JD80AB2C3D4E5F6G7H8J9K0M");
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log("No such Learner");
  } else if (error instanceof TeachMeHipaaError) {
    console.log(error.code, error.detail, error.requestId);
    for (const field of error.errors) {
      console.log(field.path, field.message);
    }
  } else {
    throw error;
  }
}
```

## Error classes

Every API failure rejects with a `TeachMeHipaaError` subclass, picked by HTTP
status. All of them are named exports and also hang off
`TeachMeHipaa.errors`.

| Class                     | Raised for                                             |
| ------------------------- | ------------------------------------------------------ |
| `InvalidRequestError`     | 400, 405, 406, 415, 422                                |
| `IdempotencyError`        | 422 `idempotency_key_reuse` (an `InvalidRequestError`) |
| `AuthenticationError`     | 401                                                    |
| `PermissionDeniedError`   | 403                                                    |
| `NotFoundError`           | 404                                                    |
| `ConflictError`           | 409                                                    |
| `PreconditionFailedError` | 412 stale ETag, 428 missing `ifMatch`                  |
| `RateLimitError`          | 429; `retryAfter` holds seconds                        |
| `ApiError`                | 5xx, or a body that isn't JSON                         |
| `ConnectionError`         | No response                                            |
| `TimeoutError`            | No response within `timeout` (a `ConnectionError`)     |
| `OAuthError`              | The token endpoint refused                             |
| `OperationFailedError`    | An Operation you waited on ended in error              |
| `OperationTimeoutError`   | `wait()` gave up first                                 |
| `WebhookSignatureError`   | A Delivery failed verification                         |

Each one carries the problem details: `status` (`null` without a response),
`code`, `title`, `detail`, `errors` (field problems with `path` and
`message`), `requestId`, `headers` and `raw` (the parsed body, or its text).

## Branching on `code`

The class names the kind of failure and `code` names the reason. New codes
can ship at any time, so keep a `default`:

```ts sample=errors-code
import { ConflictError } from "teachmehipaa";

try {
  await client.learners.update(
    "sub_01JD80AB2C3D4E5F6G7H8J9K0M",
    { externalId: "hr-123" },
    { ifMatch: "*" },
  );
} catch (error) {
  if (!(error instanceof ConflictError)) {
    throw error;
  }
  switch (error.code) {
    case "external_id_conflict":
      console.log("Another Learner already has that External ID");
      break;
    case "learner_removed":
      console.log("That Learner was offboarded");
      break;
    default:
      console.log("Conflict:", error.code, error.detail);
  }
}
```

A 422 `validation_failed` lists each bad field in `errors`, with a dot-joined
`path` such as `items.3.email`.

## Usage mistakes are `TypeError`s

Calling the library wrongly (an unknown option, an `ifMatch` object with no
ETag, `autoPagingToArray()` without a `limit`) throws a `TypeError` whose
message starts with `teachmehipaa:`. Those are bugs in the calling code and
never arrive as a `TeachMeHipaaError`.

## Retries

A failed call is retried up to `maxRetries` times (default 2) on:

- `ConnectionError` and `TimeoutError`;
- 409 with `code: "conflict"`;
- 429;
- any 5xx.

Backoff starts at 0.5 s and doubles to a 5 s cap, with jitter. A
`Retry-After` header wins, up to 60 s. Only replay-safe calls retry: reads,
writes that carry an `Idempotency-Key`, and `learners.createLaunchLink`.
`learners.update`, `webhookSubscriptions.update` and
`webhookSubscriptions.delete` never retry. When retries run out the last
error rejects; a `RateLimitError` still has `retryAfter`.

## Timeouts and cancellation

`timeout` bounds each attempt, in milliseconds (80,000 by default). With
retries, one call can take longer than `timeout` in total. A timed-out
attempt becomes a `TimeoutError`.

Per-call overrides go in the last argument:

```ts sample=configuration-per-call
const page = await client.learners.list(
  { limit: 100 },
  { timeout: 5_000, maxRetries: 0 },
);
console.log(page.items.length);
```

Requests take no `AbortSignal`; bound them with `timeout`. The loops that can
run for minutes do take one: `Operation.wait({ signal })` (see
[Operations and files](operations.md)) and `events.tail({ signal })` (see
[Lists and the Event log](pagination.md#tailing-the-event-log)).

## Request options

| Option           | Effect                                                                     |
| ---------------- | -------------------------------------------------------------------------- |
| `timeout`        | Milliseconds per attempt                                                   |
| `maxRetries`     | Retries for this call                                                      |
| `requestId`      | Sent as `X-Request-Id`; must match `^[A-Za-z0-9._-]{1,128}$`               |
| `idempotencyKey` | Replaces the generated `Idempotency-Key`; see [Writes](writes.md)          |
| `ifMatch`        | Conditional write; see [Writes](writes.md#conditional-writes)              |
| `ifNoneMatch`    | Conditional read; see [Writes](writes.md#conditional-reads)                |
| `asStream`       | Downloads only; see [Operations and files](operations.md#certificate-pdfs) |

Successful results carry the request id at `lastResponse.requestId` and
errors at `requestId`. Log it; support needs it to find the request. The API
echoes a `requestId` you send, so your own correlation id shows up on both
sides. An id that fails the pattern gets replaced by the API's own.
