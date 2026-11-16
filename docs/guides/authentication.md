# Authentication

Every call except a few public lookups needs an Access token. The client gets
one for you from your API client's credentials, keeps it, and renews it. This
guide covers how, and how to change it.

## Client credentials

An **API client** is a machine credential, a client id (`cli_…`) and secret
(`tmh_cs_…`), that an Organization admin creates in the TeachMeHIPAA console.
Pass both when you create the client:

```ts sample=auth-client-credentials
import TeachMeHipaa from "teachmehipaa";

const client = new TeachMeHipaa({
  clientId: process.env.TMH_CLIENT_ID!,
  clientSecret: process.env.TMH_CLIENT_SECRET!,
  environment: "sandbox",
});

const token = await client.auth.introspect();
console.log(token.orgId, token.scopes);
```

The client exchanges the credentials for an Access token (the OAuth 2.0
`client_credentials` grant) on the first call that needs one, then:

- caches it and renews it 60 seconds before it expires;
- shares one token request among concurrent calls;
- when the API rejects a token mid-flight (401), renews it once and replays
  the call. That replay doesn't count as a retry.

If the token endpoint refuses your credentials, the call rejects with
`OAuthError`, whose `code` is the OAuth error, such as `invalid_client`.

Create one client per set of credentials and reuse it: each new client starts
with no token. Keep the secret on your server; the library is server-only, and
a secret must never reach a browser.

## Scopes

An Access token carries Scopes, named permissions such as `learners:write`.
By default it carries every Scope your API client holds. To ask for fewer, for
a process that only reads, pass `scopes`:

```ts sample=auth-scopes
import TeachMeHipaa from "teachmehipaa";

const reader = new TeachMeHipaa({
  clientId: process.env.TMH_CLIENT_ID!,
  clientSecret: process.env.TMH_CLIENT_SECRET!,
  environment: "sandbox",
  organizationId: "org_acme",
  scopes: ["learners:read", "compliance:read"],
});

const page = await reader.learners.list({ limit: 10 });
console.log(page.items.length);
```

| Scope               | Lets you                                            |
| ------------------- | --------------------------------------------------- |
| `learners:read`     | List, retrieve and export Learners                  |
| `learners:write`    | Create, update, remind and offboard Learners        |
| `enrollments:read`  | Read Enrollments and the Seat inventory             |
| `enrollments:write` | Create, import and change Enrollments               |
| `certificates:read` | Read and export Certificates, download their PDFs   |
| `compliance:read`   | Read the Compliance summary                         |
| `members:read`      | Read the Organization's Members                     |
| `audit:read`        | Read Audit events and the Event log                 |
| `webhooks:manage`   | Manage Webhook subscriptions and read the Event log |

A call whose token lacks the Scope it needs rejects with
`PermissionDeniedError` (403). The
[resource reference](../reference/resources.md) lists the Scopes of every
method.

## Environments

Every credential belongs to one **Environment**: **Live**, the default, or
**Sandbox**, for development and tests, where Learners are never emailed.
Credentials never work across Environments.

| `environment`      | Base URL                        |
| ------------------ | ------------------------------- |
| `"live"` (default) | `https://api.tme.so/v1`         |
| `"sandbox"`        | `https://sandbox.api.tme.so/v1` |

`baseUrl` overrides the Environment's URL, such as to point at a mock server.
`auth.introspect()` tells you which Environment a token is for: its `mode` is
`test` for the Sandbox and `live` otherwise.

## The Organization binding

An API client belongs to one Organization, so you never pass an Organization
id to a method. On the first call that needs it, the client asks
`auth.introspect` which Organization the token is for, once, and remembers the
answer. If you already know the id, pass it and the client skips that lookup:

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
Organization, create another client with that Organization's credentials.

## A static Access token

If you get Access tokens some other way, such as from a secrets service that
mints them, pass a token provider instead of credentials.
`staticTokenProvider` wraps one token:

```ts sample=auth-static-token
import TeachMeHipaa, { staticTokenProvider } from "teachmehipaa";

const client = new TeachMeHipaa({
  tokenProvider: staticTokenProvider(process.env.TMH_ACCESS_TOKEN!),
  environment: "sandbox",
  organizationId: "org_acme",
});

const member = await client.members.retrieve("sub_01JD80AB2C3D4E5F6G7H8J9K0M");
console.log(member.lastResponse.status);
```

A static token is never renewed: once it expires, calls reject with
`AuthenticationError`. For tokens that rotate, implement the `TokenProvider`
interface yourself: `getAccessToken()` resolves the current token, and
`invalidate(token)` is called when the API rejected that token, so the next
`getAccessToken()` fetches a fresh one.

## Public lookups without credentials

Three methods are public: `courses.list`, `courses.retrieve` and
`certificateVerifications.retrieve`. They never send an Access token. To call
only those, such as to check a Certificate someone showed you, create a
client without credentials:

```ts sample=public-lookups
import TeachMeHipaa from "teachmehipaa";

const client = new TeachMeHipaa({ environment: "sandbox" });

const verification = await client.certificateVerifications.retrieve("aB3dE9");
console.log(verification.status, verification.learnerName);

const courses = await client.courses.list();
console.log(courses.items.map((course) => course.title));
```

Any other method on such a client rejects with a `TypeError` before it sends
anything. Giving only one of `clientId` and `clientSecret` is a mistake, so it
throws a `TypeError` when you create the client.
