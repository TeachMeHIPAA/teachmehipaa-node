# TeachMeHIPAA Node.js Library

The official Node.js and TypeScript library for the
[TeachMeHIPAA Developer API](https://api.tme.so/v1). It handles Access tokens,
the Organization binding, retries, idempotency keys, typed errors, pagination,
ETags, Operations and webhook verification, so your code only calls methods.

> [!NOTE]
> The Developer API has not launched yet, and this package is not on npm.
> Until it is, install it from a local checkout.

## Contents

- [Installation](#installation)
- [Quickstart](#quickstart)
- [The Organization binding](#the-organization-binding)
- [Creating Learners](#creating-learners)
- [Pagination](#pagination)
- [Errors](#errors)
- [Retries and idempotency](#retries-and-idempotency)
- [Conditional writes](#conditional-writes)
- [Operations](#operations)
- [Uploads and downloads](#uploads-and-downloads)
- [Webhooks](#webhooks)
- [Partner apps](#partner-apps)
- [Tailing the Event log](#tailing-the-event-log)
- [Configuration](#configuration)
- [Logging](#logging)
- [Supported runtimes](#supported-runtimes)
- [Versioning](#versioning)
- [Support and security](#support-and-security)

## Installation

```sh
npm install teachmehipaa
```

The package has no runtime dependencies. It ships ESM and CommonJS builds with
TypeScript types, so `import` and `require` both work.

## Quickstart

Create an API client in the TeachMeHIPAA console to get a client id
(`cli_…`) and secret (`tmh_cs_…`). Start in the Sandbox Environment, where no
real Learners are emailed and no real money moves.

```ts sample=quickstart
import TeachMeHipaa from "teachmehipaa";

const client = new TeachMeHipaa({
  clientId: process.env.TMH_CLIENT_ID!,
  clientSecret: process.env.TMH_CLIENT_SECRET!,
  environment: "sandbox",
});

const learner = await client.learners.retrieve(
  "sub_01JD80AB2C3D4E5F6G7H8J9K0M",
);
console.log(learner.name, learner.status);

const page = await client.learners.list({ status: "in_progress", limit: 20 });
for (const item of page.items) {
  console.log(item.email);
}
```

The client exchanges your credentials for an Access token on the first call,
caches it and renews it 60 seconds before it expires. Concurrent calls share
one token request. If the API rejects a token mid-flight (401), the client
renews it once and replays the call; that replay doesn't count as a retry.

Every method is async and takes its parameters first and
[request options](#retries-and-idempotency) last:
`client.learners.list(params?, options?)`. Every object it returns has a
non-enumerable `lastResponse` with the HTTP `status`, `headers`, `requestId`
and `etag`.

To ask for fewer Scopes than your API client holds, pass `scopes`, such as
`scopes: ["learners:read"]`.

## The Organization binding

An API client belongs to one Organization, so you never pass an `orgId`. On
the first Organization-scoped call, the client asks `auth.introspect` which
Organization the token is for, once, and remembers the answer. If you already
know the id, pass it and the client skips that lookup:

```ts sample=organization
import TeachMeHipaa from "teachmehipaa";

const client = new TeachMeHipaa({
  clientId: process.env.TMH_CLIENT_ID!,
  clientSecret: process.env.TMH_CLIENT_SECRET!,
  organizationId: "org_acme",
});

const compliance = await client.compliance.retrieve();
console.log(compliance.lastResponse.requestId);
```

A client's configuration is fixed when you create it. To act for another
Organization, create another client. Partner-level calls (`partners.*`) are
not Organization-scoped and take the `partnerId` as their first argument.

Public methods, `courses.list`, `courses.retrieve` and
`certificateVerifications.retrieve`, send no Access token at all.

## Creating Learners

`create` and `upsertByExternalId` say whether they created the Learner in
`created`. `upsertByExternalId` is safe to replay from a sync job: it creates
and invites the Learner the first time and returns them every time after.

```ts sample=learner-writes
const created = await client.learners.create({
  email: "ana@example.com",
  name: "Ana Example",
  courseId: "hipaa-2026",
});
console.log(created.created ? "invited" : "already enrolled");

const synced = await client.learners.upsertByExternalId("hr-123", {
  email: "ana@example.com",
  name: "Ana Example",
});
console.log(synced.learnerId);
```

Samples from here on assume a `client` created as in the
[Quickstart](#quickstart).

## Pagination

List methods return a page you can await, or iterate with `for await` to get
every item across all pages. Pages are fetched only as you consume them.

```ts sample=pagination
// Every Learner, page by page, fetched lazily.
for await (const learner of client.learners.list({ limit: 100 })) {
  console.log(learner.learnerId);
}

// At most 500 Learners in one array. The limit is required, so a large list
// can't fill memory by accident.
const learners = await client.learners
  .list({ status: "expired" })
  .autoPagingToArray({ limit: 500 });

// One page at a time.
const page = await client.enrollments.list({ limit: 50 });
if (page.hasNextPage()) {
  const next = await page.getNextPage();
  console.log(next.items.length, learners.length);
}
```

## Errors

Failed calls raise a subclass of `TeachMeHipaaError`, chosen by HTTP status:

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

Each carries the problem's `code` (branch on it; new codes can appear at any
time), `title`, `detail`, field-level `errors`, the `status` and the
`requestId` to quote to support. Every class is also on
`TeachMeHipaa.errors`.

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

## Retries and idempotency

The client retries network errors, 409 `conflict`, 429 and 5xx up to
`maxRetries` times (2 by default), backing off from 0.5 s up to 5 s with jitter
and honoring `Retry-After` up to 60 s. It only retries calls that are safe to
replay: reads, writes that carry an `Idempotency-Key`, and the few writes that
are idempotent by nature, such as `seatOrders.quote`. PATCH and DELETE are
never retried.

Every create and custom method gets a generated UUID `Idempotency-Key`, reused
by each of its retries, so a retry never enrolls a Learner twice or charges
twice. Pass your own to make a call safe to repeat across processes:

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

Request options, the last argument of every method:

| Option           | Effect                                                     |
| ---------------- | ---------------------------------------------------------- |
| `idempotencyKey` | Replaces the generated `Idempotency-Key`                   |
| `maxRetries`     | Overrides the client's `maxRetries` for this call          |
| `timeout`        | Milliseconds to wait for each response                     |
| `requestId`      | Sent as `X-Request-Id`, to correlate your logs with ours   |
| `ifMatch`        | Conditional writes; see below                              |
| `ifNoneMatch`    | Conditional reads: a 304 resolves `{ notModified: true }`  |
| `asStream`       | Downloads: resolve a web `ReadableStream` instead of bytes |

## Conditional writes

Updates that the API guards with ETags take `ifMatch`: the ETag string, or the
object you read, whose `lastResponse.etag` the client sends. `learners.update`
and `webhookSubscriptions.update` require it, since the API refuses them
without one; on `learners.offboard` it is optional. A stale ETag raises
`PreconditionFailedError`. A PATCH sends only the fields you pass; pass
`null` to clear a field.

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

## Operations

Exports, imports, batch actions and test deliveries return an Operation. `wait()` polls
until it is done (by default for up to 5 minutes), and an export's
`exportResult()` hands back the CSV.

```ts sample=operations
const operation = await client.learners.export({
  format: "csv",
  courseId: "hipaa-2026",
});
const done = await operation.wait({ timeout: 60_000, interval: 2_000 });
const { csv, filename, rowCount } = done.exportResult();
console.log(filename, rowCount, csv.length);
```

A failed Operation raises `OperationFailedError` and one still running at the
timeout raises `OperationTimeoutError`; both carry the `operation`, so you can
wait on it again.

## Uploads and downloads

An Enrollment import takes the CSV as a file path, bytes, a `Blob`, a web
`ReadableStream` or a Node `Readable`. A string is always a path; pass CSV text
as `new Blob([text])`. Certificate PDFs come back as bytes, or as a stream with
`asStream: true`, with the `contentType` and `filename` the API sent.

```ts sample=files
import { createWriteStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const preview = await client.enrollments.previewImport({
  file: "./roster.csv",
  options: { courseId: "hipaa-2026" },
});
console.log(preview);
const imported = await client.enrollments.import({ file: "./roster.csv" });
await imported.wait();

const pdf = await client.certificates.downloadPdf("cert_01JD8F");
await writeFile(pdf.filename ?? "certificate.pdf", pdf.data);

const { stream } = await client.certificates.downloadPdf("cert_01JD8F", {
  asStream: true,
});
await pipeline(Readable.fromWeb(stream), createWriteStream("certificate.pdf"));
```

## Webhooks

`webhooks.constructEvent` verifies a Delivery and returns its Event, or a Test
delivery (which has `test: true`). It needs three things exactly as they
arrived:

1. **The raw body.** Parsed and re-serialized JSON never verifies, so read the
   body as bytes or text before any JSON middleware touches it.
2. **The headers.**
3. **The request path, with its query string.** The signature covers the path
   the Delivery was sent to, so a verifier that ignores it rejects every
   Delivery.

Deliveries signed more than 5 minutes from your clock, in either direction,
are rejected. Verification raises `WebhookSignatureError` with a `code` such
as `signature_mismatch`; answer it with 400. Event types this version doesn't
know arrive as an `UnknownEvent`, so new types never break your handler.

`webhooks` needs only the Signing secret, so a handler without API credentials
can import it on its own. It is also available as `client.webhooks` and
`TeachMeHipaa.webhooks`.

With Express, mount `express.raw` on the webhook route and pass
`req.originalUrl`, which keeps the mount path and query string:

```ts sample=webhook-express
import express from "express";
import { WebhookSignatureError, webhooks } from "teachmehipaa";

const app = express();

app.post(
  "/webhooks/tmh",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const event = await webhooks.constructEvent(
        req.body as Buffer,
        req.headers,
        process.env.TMH_WEBHOOK_SECRET!,
        req.originalUrl,
      );
      if ("test" in event) {
        res.sendStatus(200);
        return;
      }
      if (event.eventType === "learner.certified") {
        console.log("Certified:", event.data);
      }
      res.sendStatus(200);
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        res.status(400).send(error.code);
        return;
      }
      throw error;
    }
  },
);

app.listen(3000);
```

With a fetch-style handler (Bun, Deno, Cloudflare Workers, Next.js route
handlers), the full request URL works as the path:

```ts sample=webhook-fetch
import { WebhookSignatureError, webhooks } from "teachmehipaa";

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      const event = await webhooks.constructEvent(
        await request.text(),
        request.headers,
        process.env.TMH_WEBHOOK_SECRET!,
        request.url,
      );
      if ("test" in event) {
        return new Response("test received");
      }
      return new Response(`received ${event.eventType}`);
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        return new Response(error.code, { status: 400 });
      }
      throw error;
    }
  },
};
```

To test your handler, sign a payload the way TeachMeHIPAA does with
`generateTestHeaders`:

```ts sample=webhook-test-headers
import { webhooks } from "teachmehipaa";

const payload = JSON.stringify({
  eventId: "evt_01JD8M",
  eventType: "learner.certified",
  orgId: "org_acme",
  occurredAt: "2026-11-15T12:00:00.000Z",
  data: { subjectId: "sub_01JD80AB2C3D4E5F6G7H8J9K0M", courseId: "hipaa-2026" },
});
const headers = await webhooks.generateTestHeaders({
  payload,
  secret: "test-signing-secret",
  path: "/webhooks/tmh",
});

const event = await webhooks.constructEvent(
  payload,
  headers,
  "test-signing-secret",
  "/webhooks/tmh",
);
console.log(event);
```

## Partner apps

A Partner app acts for many Organizations, each connected through a Grant that
an admin approves on the TeachMeHIPAA consent screen. `TeachMeHipaa.oauth`
builds the consent URL with a PKCE challenge and exchanges the returned code.
Keep the `state` and `codeVerifier` in the admin's session between the two
steps. The `sessions` and `grants` objects below stand in for your own
storage.

```ts sample=partner-consent
import TeachMeHipaa from "teachmehipaa";

const { codeVerifier, codeChallenge } =
  await TeachMeHipaa.oauth.createPkcePair();
const state = TeachMeHipaa.oauth.createState();
await sessions.save({ state, codeVerifier });

const consentUrl = TeachMeHipaa.oauth.authorizeUrl({
  clientId: process.env.TMH_APP_ID!,
  redirectUri: "https://partner.example.com/tmh/callback",
  scopes: ["learners:read", "learners:write"],
  state,
  codeChallenge,
});
console.log(`Redirect the admin to ${consentUrl}`);

// Later, on the redirect to https://partner.example.com/tmh/callback:
const callback = new URL(
  "https://partner.example.com/tmh/callback?code=…&state=…",
);
const saved = await sessions.load();
if (callback.searchParams.get("state") !== saved.state) {
  throw new Error("state mismatch: possible CSRF");
}
const grant = await TeachMeHipaa.oauth.exchangeCode({
  clientId: process.env.TMH_APP_ID!,
  clientSecret: process.env.TMH_APP_SECRET!,
  code: callback.searchParams.get("code")!,
  redirectUri: "https://partner.example.com/tmh/callback",
  codeVerifier: saved.codeVerifier,
});
await grants.save("org_acme", grant.refreshToken);
```

Then create a client per connected Organization with
`partnerGrantTokenProvider`. Every token exchange rotates the Grant's Refresh
token, and the provider saves each new one to your `tokenStore` before it uses
the Access token that came with it.

```ts sample=partner-grant
import TeachMeHipaa, {
  partnerGrantTokenProvider,
  type TokenStore,
} from "teachmehipaa";

const tokenStore: TokenStore = {
  load: () => grants.load("org_acme"),
  save: (refreshToken) => grants.save("org_acme", refreshToken),
};

const client = new TeachMeHipaa({
  tokenProvider: partnerGrantTokenProvider({
    clientId: process.env.TMH_APP_ID!,
    clientSecret: process.env.TMH_APP_SECRET!,
    tokenStore,
  }),
  organizationId: "org_acme",
});

const learners = await client.learners.list();
console.log(learners.items.length);
```

A Grant belongs to one Environment, so give the provider the same
`environment` (or `baseUrl`) as the client. The provider exposes the one it
exchanges Refresh tokens at as `baseUrl`, and the client throws a `TypeError`
at construction when it differs from its own, rather than sending Sandbox
requests with tokens refreshed against Live.

> [!WARNING]
> Presenting a superseded Refresh token revokes the whole Grant (ADR-0004). So
> `tokenStore.save` must persist durably before it resolves, you should create
> one provider per Grant and share it between clients, and a Refresh token
> exchange is **never retried**: a network error during one raises
> `ConnectionError`, and an `OAuthError` with code `invalid_grant` means the
> Organization must go through consent again. Never retry these yourself with
> an old Refresh token.

For the Partner's own calls, such as listing and creating customer
Organizations, authenticate with the Partner app's own id (`app_…`) and secret
(`tmh_as_…`) as `clientId` and `clientSecret`, and pass your `partnerId`:

```ts sample=partner-organizations
import TeachMeHipaa from "teachmehipaa";

const partner = new TeachMeHipaa({
  clientId: process.env.TMH_APP_ID!,
  clientSecret: process.env.TMH_APP_SECRET!,
});

for await (const organization of partner.partners.organizations.list(
  "ptn_01JD8E2C3D4E5F6G7H8J9K0M1N",
)) {
  console.log(organization.orgId, organization.grantActive);
}
```

If you get Access tokens some other way, pass
`tokenProvider: staticTokenProvider(accessToken)`. A static token is never
renewed; once it expires, calls raise `AuthenticationError`.

## Tailing the Event log

`events.tail` reads the Event log oldest first and keeps its own position in
`lastEventId`. Save it, and resume from it after a restart to catch up on
anything you missed while down, without webhooks. Here `cursors` stands in for
your own storage:

```ts sample=events-tail
const controller = new AbortController();
const tail = client.events.tail({
  after: await cursors.load(),
  follow: true,
  interval: 5_000,
  signal: controller.signal,
});

for await (const event of tail) {
  console.log(event.eventType, event.eventId);
  await cursors.save(tail.lastEventId);
}
```

Without `follow`, the loop ends once it has caught up. With it, the tail polls
every `interval` milliseconds until you `break` or abort the signal.

## Configuration

```ts sample=configuration
import TeachMeHipaa from "teachmehipaa";

const client = new TeachMeHipaa({
  clientId: process.env.TMH_CLIENT_ID!,
  clientSecret: process.env.TMH_CLIENT_SECRET!,
  environment: "sandbox",
  scopes: ["learners:read", "learners:write"],
  organizationId: "org_acme",
  maxRetries: 3,
  timeout: 30_000,
  appInfo: {
    name: "acme-hr-sync",
    version: "4.2.0",
    url: "https://acme.example",
  },
});
console.log(typeof client.learners.list);
```

| Option           | Default                               | Description                                                                        |
| ---------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| `clientId`       | (required, or `tokenProvider`)        | Your API client's id (`cli_…`), or a Partner app's (`app_…`)                       |
| `clientSecret`   | (required with `clientId`)            | The matching secret (`tmh_cs_…` or `tmh_as_…`)                                     |
| `scopes`         | Every Scope the API client holds      | Narrows the Access token's Scopes                                                  |
| `tokenProvider`  | Client credentials                    | Supplies Access tokens instead: `partnerGrantTokenProvider`, `staticTokenProvider` |
| `environment`    | `"live"`                              | `"live"` or `"sandbox"`; credentials work only in their own Environment            |
| `baseUrl`        | The Environment's URL                 | Overrides it, e.g. to point at a mock server                                       |
| `organizationId` | Looked up once with `auth.introspect` | The Organization to act for                                                        |
| `maxRetries`     | `2`                                   | Retries of a failed call that is safe to replay                                    |
| `timeout`        | `80000`                               | Milliseconds to wait for each response                                             |
| `appInfo`        | None                                  | `{ name, version?, url? }` of your software, sent in the `User-Agent`              |
| `logger`         | None                                  | Opt-in request logging; see [Logging](#logging)                                    |
| `fetch`          | `globalThis.fetch`                    | A `fetch` to send requests with, e.g. one with a proxy dispatcher                  |
| `transport`      | A `fetch` transport                   | Replaces the HTTP layer entirely, e.g. with a fake in tests (not with `fetch`)     |
| `clock`          | Real time                             | Supplies the time and sleeps, for tests                                            |

Base URLs: Live is `https://api.tme.so/v1`; Sandbox is
`https://api-teachmehipaa-dev.web.app/v1`. Unknown options raise a
`TypeError` when you create the client, so a typo fails fast.

## Logging

The library writes nothing to the console, sends no telemetry and writes
nothing to disk. Pass a `logger` to get one entry per HTTP response, token
requests included, with the method, path (without its query string, which can
hold Learner emails), status, latency and request id. Request and response
bodies and credentials are never logged (ADR-0007), because they hold Learner
details.

```ts sample=logging
import TeachMeHipaa from "teachmehipaa";

const client = new TeachMeHipaa({
  clientId: process.env.TMH_CLIENT_ID!,
  clientSecret: process.env.TMH_CLIENT_SECRET!,
  organizationId: "org_acme",
  logger: console,
});

await client.learners.list();
```

Any object with a `debug(message, fields)` method works, such as a `pino` or
`winston` logger.

## Supported runtimes

Node.js 20 and newer. Bun and Deno work too, since the library uses only
`fetch`, Web Crypto and `node:crypto`. It is server-only: your client secret
must never reach a browser.

## Versioning

The library follows semantic versioning. Its resources and models are
generated from the Developer API's OpenAPI document; the `OPENAPI_VERSION`
file names the document release this version was generated from. Models are
tolerant: unknown response fields are kept, and enum fields accept values this
version doesn't know, so API additions don't break your build or your
runtime. See the [changelog](CHANGELOG.md).

## Support and security

<!-- TODO(Nick): confirm the support address before launch. -->

For help, contact TeachMeHIPAA support and quote the `requestId` from the
error or `lastResponse`. To report a vulnerability, see
[SECURITY.md](SECURITY.md); please don't open a public issue.

See [CONTRIBUTING.md](CONTRIBUTING.md) to work on the library.
