# Writes

Samples use the `client` from [The client](client.md).

## Create or upsert

`learners.create` invites someone by email. `created` on the result is
`false` when the Learner already existed:

```ts sample=writes-create
const learner = await client.learners.create({
  email: "ana@example.com",
  name: "Ana Example",
  courseId: "hipaa-2026",
});
console.log(learner.learnerId, learner.created ? "invited" : "already there");
```

A sync job should key people by your own id, the External ID.
`learners.upsertByExternalId` creates and invites on the first call and
returns the same Learner on every later one, so a rerun is harmless:

```ts sample=writes-upsert
const synced = await client.learners.upsertByExternalId("hr-123", {
  email: "ana@example.com",
  name: "Ana Example",
});
console.log(synced.learnerId, synced.created);
```

[`examples/sync-roster.ts`](../../examples/sync-roster.ts) runs a whole
roster through it.

`seatPolicy: "require_available"` turns "no free Seat" into a 409 you can
catch:

```ts sample=writes-seat-policy
import { ConflictError, TeachMeHipaaError } from "@teachmehipaa/node";

try {
  await client.learners.create({
    email: "ana@example.com",
    seatPolicy: "require_available",
  });
} catch (error) {
  if (error instanceof ConflictError && error.code === "seat_unavailable") {
    console.log("No Seat is free for this Learner");
  } else if (error instanceof TeachMeHipaaError) {
    console.log(error.code, error.requestId);
  } else {
    throw error;
  }
}
```

## Idempotency keys

`learners.upsertByExternalId` and every POST except
`learners.createLaunchLink` send an `Idempotency-Key`. The client makes one
UUID per call and resends it on each retry, so a retried create enrolls nobody
twice.

A job that may run twice across processes needs a key that survives the
process. Derive it from the work:

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

The API stores each key with its request body. The same key with a different
body rejects with `IdempotencyError` (422 `idempotency_key_reuse`).

## Conditional writes

Every returned object has a non-enumerable `lastResponse`; its `etag` is the
version the API sent, or `null`. Wherever a method wants an ETag, pass the
string or the object, and the client reads `lastResponse.etag` itself.

| Method                        | `ifMatch`                    |
| ----------------------------- | ---------------------------- |
| `learners.update`             | Required (the API sends 428) |
| `webhookSubscriptions.update` | Required (the API sends 428) |
| `learners.offboard`           | Optional                     |

The types enforce the required ones. A stale ETag rejects with
`PreconditionFailedError` (412): read again, reapply, write again. `"*"`
matches any version.

```ts sample=conditional-write
import { PreconditionFailedError } from "@teachmehipaa/node";

const learner = await client.learners.retrieve(
  "sub_01JD80AB2C3D4E5F6G7H8J9K0M",
);
try {
  const updated = await client.learners.update(
    learner.learnerId,
    { name: "Ana Q. Example", externalId: null },
    { ifMatch: learner },
  );
  console.log(updated.name);
} catch (error) {
  if (error instanceof PreconditionFailedError) {
    console.log("Someone else changed this Learner; read it again");
  } else {
    throw error;
  }
}
```

An `ifMatch` object whose response carried no ETag throws a `TypeError`
before sending, so a write never turns unconditional by accident.

## Merge patches

`update` methods send `application/merge-patch+json`. A field you pass is
set. A field you omit, or set to `undefined`, stays as it is. `null` clears a
nullable field. Above, `name` changes and `externalId` is cleared.

```ts sample=conditional-update-subscription
const subscription = await client.webhookSubscriptions.retrieve("whs_01JD8Q");
const paused = await client.webhookSubscriptions.update(
  subscription.subscriptionId,
  { enabled: false, description: null },
  { ifMatch: subscription },
);
console.log(paused.enabled, paused.lastResponse.etag);
```

Merge patches never retry. On a 409 or 412, read and try again yourself.

## Conditional reads

`courses.retrieve`, `enrollments.retrieve` and
`webhookSubscriptions.retrieve` accept `ifNoneMatch`. If the object still has
that ETag, the API answers 304 and the method resolves `{ notModified: true }`:

```ts sample=conditional-read
const cached = await client.courses.retrieve("hipaa-2026");

const latest = await client.courses.retrieve("hipaa-2026", {
  ifNoneMatch: cached,
});
const course = "notModified" in latest ? cached : latest;
console.log(course.title);
```

Without `ifNoneMatch` the return type is the object alone, with no
`notModified` case to check.
