# Errors and retries

## Error classes

A failed call rejects with a subclass of `TeachMeHipaaError`, chosen by the
HTTP status:

| Class                     | When                                                   |
| ------------------------- | ------------------------------------------------------ |
| `InvalidRequestError`     | 400, 405, 406, 415 and 422                             |
| `IdempotencyError`        | 422 `idempotency_key_reuse` (an `InvalidRequestError`) |
| `AuthenticationError`     | 401                                                    |
| `PermissionDeniedError`   | 403, such as a missing Scope                           |
| `NotFoundError`           | 404                                                    |
| `ConflictError`           | 409                                                    |
| `PreconditionFailedError` | 412 (stale ETag) and 428 (missing `ifMatch`)           |
| `RateLimitError`          | 429, with `retryAfter` in seconds                      |
| `ApiError`                | 5xx, or a response that isn't JSON                     |
| `ConnectionError`         | No response arrived                                    |
| `TimeoutError`            | No response within `timeout` (a `ConnectionError`)     |
| `OAuthError`              | The token endpoint refused to issue a token            |
| `OperationFailedError`    | An Operation you waited on finished with an error      |
| `OperationTimeoutError`   | An Operation wasn't done when `wait()` gave up         |
| `WebhookSignatureError`   | A Delivery failed verification                         |

Each error carries the API's problem details:

| Property    | What it holds                                                 |
| ----------- | ------------------------------------------------------------- |
| `status`    | The HTTP status, or `null` when no response arrived           |
| `code`      | The machine-readable reason, such as `seat_unavailable`       |
| `title`     | A short, human-readable summary                               |
| `detail`    | An explanation of this occurrence                             |
| `errors`    | Field-level problems, each with a `path` and `message`        |
| `requestId` | The `X-Request-Id` of the response, to quote to support       |
| `headers`   | The response headers                                          |
| `raw`       | The response body: parsed JSON, or the text if it wasn't JSON |

Every class is exported, and also reachable as `TeachMeHipaa.errors`.

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

Samples from here on use a `client` created as in
[Getting started](getting-started.md).

## Branching on `code`

The class tells you the kind of failure; `code` tells you the reason. Branch
on `code` when you handle a case specially. New codes can appear at any time,
so always keep a fallback:

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

A `validation_failed` problem (422) lists each invalid field in `errors`:
`path` is the dot-joined field path, such as `items.3.email`.

## Request ids

Every response carries a request id. Successful results expose it as
`lastResponse.requestId`, and errors as `requestId`. Log it: it is what
TeachMeHIPAA support needs to find a request. To correlate with your own logs,
send your own id with the `requestId` request option; the API echoes it back.

## Mistakes in calling the library

A mistake in how you call the library, such as an unknown client option, an
`ifMatch` object that has no ETag or `autoPagingToArray` without a limit, throws
a plain `TypeError` whose message starts with `teachmehipaa:`. These are bugs
to fix, not failures to handle, so they are never a `TeachMeHipaaError`.

## Retries

The client retries a failed call up to `maxRetries` times (2 by default) when
the failure is transient:

- no response arrived (`ConnectionError`, `TimeoutError`);
- 409 with the code `conflict` (a concurrent write);
- 429 (`RateLimitError`);
- any 5xx.

It backs off exponentially from 0.5 s up to 5 s, with jitter, and honors a
`Retry-After` header up to 60 s. It retries only calls that are safe to
replay: reads, writes that carry an `Idempotency-Key`, and the few writes that
are idempotent by nature, such as `learners.createLaunchLink`. PATCH and
DELETE calls are never retried. The
[resource reference](../reference/resources.md) says which methods retry.

A 429 or 5xx that outlasts the retries rejects as usual; `RateLimitError`
carries the `retryAfter` the API asked for, in seconds.

## Idempotency

Every create and custom method sends an `Idempotency-Key` header: a UUID the
client generates once per call and reuses on each of its retries, so a retry
never enrolls a Learner twice.

To make a call safe to repeat across processes, such as a sync job that may
run twice, pass your own key, derived from what the call does:

```ts sample=request-options
const enrollment = await client.enrollments.create(
  { email: "ana@example.com", courseId: "hipaa-2026" },
  {
    idempotencyKey: "hr-sync-2026-11-15-ana",
    maxRetries: 5,
    timeout: 10_000,
    requestId: "hr-sync-42",
  },
);
console.log(enrollment.lastResponse.requestId);
```

The API remembers a key with the request it came with. Sending the same key
with a different body rejects with `IdempotencyError`, so never reuse a key
for a different request.

## Request options

Every method takes request options as its last argument:

| Option           | Effect                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `idempotencyKey` | Replaces the generated `Idempotency-Key`                                                       |
| `maxRetries`     | Overrides the client's `maxRetries` for this call                                              |
| `timeout`        | Milliseconds to wait for each response; overrides the client's                                 |
| `requestId`      | Sent as `X-Request-Id`, to correlate your logs with ours                                       |
| `ifMatch`        | Conditional writes; see [Conditional requests](conditional-requests.md)                        |
| `ifNoneMatch`    | Conditional reads; see [Conditional requests](conditional-requests.md)                         |
| `asStream`       | Downloads: resolve a web `ReadableStream`; see [Operations and files](operations-and-files.md) |

`requestId` must match `^[A-Za-z0-9._-]{1,128}$`, or the API replaces it with
its own.
