# Getting started

This guide takes you from nothing to inviting your first Learner in the
Sandbox Environment. It takes about ten minutes.

## 1. Install the library

The Developer API is in pre-release and the package isn't on npm yet, so
build it from source and install the tarball:

```sh
git clone https://github.com/TeachMeHIPAA/teachmehipaa-node.git
cd teachmehipaa-node
npm ci
npm run build
npm pack   # writes teachmehipaa-0.0.0.tgz

cd ../your-project
npm install ../teachmehipaa-node/teachmehipaa-0.0.0.tgz
```

You need Node.js 20 or newer. The library has no runtime dependencies and
works from ESM (`import`) and CommonJS (`require`).

## 2. Get Sandbox credentials

An Organization admin creates an **API client** in the TeachMeHIPAA console.
It has a client id (`cli_…`) and a client secret (`tmh_cs_…`), and belongs to
exactly one Organization. Create it in the Sandbox Environment first: Sandbox
Learners are never emailed, so you can experiment freely.

Keep the secret on your server. Put both values in the environment:

```sh
export TMH_CLIENT_ID=cli_...
export TMH_CLIENT_SECRET=tmh_cs_...
```

## 3. Make your first call

Create one client and reuse it for the life of your process. It fetches an
Access token on the first call and renews it before it expires.

```ts sample=getting-started-first-call
import TeachMeHipaa from "teachmehipaa";

const client = new TeachMeHipaa({
  clientId: process.env.TMH_CLIENT_ID!,
  clientSecret: process.env.TMH_CLIENT_SECRET!,
  environment: "sandbox",
});

const summary = await client.compliance.retrieve();
console.log(
  summary.totals.compliant,
  "of",
  summary.totals.learners,
  "compliant",
);
```

You never pass an Organization id: the client asks the API which Organization
your API client belongs to, once, and remembers it. See
[Authentication](authentication.md) for the details.

## 4. Invite a Learner

`learners.create` invites someone to a Course by email. The result's `created`
says whether this call created the Learner or found an existing one.

```ts sample=getting-started-invite
const learner = await client.learners.create({
  email: "ana@example.com",
  name: "Ana Example",
  courseId: "hipaa-2026",
});
console.log(learner.learnerId, learner.created ? "invited" : "already there");
```

If you sync people from another system, prefer
`learners.upsertByExternalId`, keyed by your own id for the person, their
External ID. It creates and invites the Learner the first time and returns
them every time after, so a sync job can replay it safely:

```ts sample=getting-started-upsert
const synced = await client.learners.upsertByExternalId("hr-123", {
  email: "ana@example.com",
  name: "Ana Example",
});
console.log(synced.learnerId, synced.created);
```

The [roster sync example](../../examples/sync-roster.ts) shows it end to end.

## 5. Handle failures

A failed call rejects with a subclass of `TeachMeHipaaError`. Branch on the
class, or on its `code`, and log the `requestId` so support can find the
request. Here `seatPolicy: "require_available"` makes the create fail with a
409 when no Seat is free:

```ts sample=getting-started-errors
import { ConflictError, TeachMeHipaaError } from "teachmehipaa";

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

## Next steps

- [Pagination and the Event log](pagination-and-events.md) to read lists and
  follow what changes.
- [Webhooks](webhooks.md) to be told when a Learner is certified.
- [Errors and retries](errors-and-retries.md) for every error class and how
  the client retries.
- The [resource reference](../reference/resources.md) for every method.
