# Conditional requests

The API tags versions of an object with an **ETag**. Send it back with a
write, and the write happens only if nobody changed the object since you read
it. Send it with a read, and the API skips the transfer when your copy is
still current.

Samples use a `client` created as in [Getting started](getting-started.md).

## Where ETags come from

Every object the library returns has a non-enumerable `lastResponse`, whose
`etag` is the ETag the API sent with it, or `null` when it sent none.
Wherever a method takes an ETag, you can pass either the ETag string or the
object itself; the library reads `lastResponse.etag` for you.

## Conditional writes with `ifMatch`

Updates that the API guards with ETags take `ifMatch`, sent as `If-Match`:

| Method                        | `ifMatch`                                |
| ----------------------------- | ---------------------------------------- |
| `learners.update`             | Required: the API answers 428 without it |
| `webhookSubscriptions.update` | Required: the API answers 428 without it |
| `learners.offboard`           | Optional                                 |

The types make the required ones required. A stale ETag rejects with
`PreconditionFailedError` (412): read the object again, reapply your change
and retry. `"*"` matches any version, for when you mean to overwrite.

```ts sample=conditional-write
import { PreconditionFailedError } from "teachmehipaa";

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

Passing an object whose response had no ETag throws a `TypeError` before
anything is sent, rather than silently making the write unconditional.

## Merge-patch updates

`update` methods send a JSON merge patch (`application/merge-patch+json`):

- a field you pass is set to the value you pass;
- a field you leave out, or set to `undefined`, is left unchanged;
- a field you set to `null` is cleared, where the field allows it.

In the sample above, `name` changes, `externalId` is cleared, and nothing
else is touched. Merge-patch updates are never retried, since replaying one
isn't safe; on a conflict, read and try again yourself.

```ts sample=conditional-update-subscription
const subscription = await client.webhookSubscriptions.retrieve("whs_01JD8Q");
const paused = await client.webhookSubscriptions.update(
  subscription.subscriptionId,
  { enabled: false, description: null },
  { ifMatch: subscription },
);
console.log(paused.enabled, paused.lastResponse.etag);
```

## Conditional reads with `ifNoneMatch`

`courses.retrieve`, `enrollments.retrieve` and
`webhookSubscriptions.retrieve` take `ifNoneMatch`, sent as `If-None-Match`.
When the object still has that ETag, the API answers 304 and the method
resolves `{ notModified: true }` instead of the object, so keep your copy:

```ts sample=conditional-read
const cached = await client.courses.retrieve("hipaa-2026");

const latest = await client.courses.retrieve("hipaa-2026", {
  ifNoneMatch: cached,
});
const course = "notModified" in latest ? cached : latest;
console.log(course.title);
```

Without `ifNoneMatch`, the method's type is the object alone, so you only
check for `notModified` when you asked for it.
