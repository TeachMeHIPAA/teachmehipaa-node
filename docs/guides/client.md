# The client

```ts sample=auth-client-credentials
import TeachMeHipaa from "@teachmehipaa/node";

const client = new TeachMeHipaa({
  clientId: process.env.TMH_CLIENT_ID!,
  clientSecret: process.env.TMH_CLIENT_SECRET!,
  environment: "sandbox",
});

const token = await client.auth.introspect();
console.log(token.orgId, token.scopes);
```

Create one `TeachMeHipaa` per set of credentials and keep it for the life of
the process. Its options are fixed at construction; for different settings,
create a second client.

## Credentials and Access tokens

An Organization admin creates an API client in the TeachMeHIPAA console: a
client id (`cli_…`) and a secret (`tmh_cs_…`). The client trades them for an
Access token (OAuth 2.0 `client_credentials`) on the first call that needs
one, caches it, and renews it 60 s before it expires. Concurrent calls share
one token request. When the API rejects a token with a 401, the client renews
it once and replays the call; that replay is not counted as a retry.

Refused credentials reject with `OAuthError`, whose `code` is the OAuth error
(`invalid_client`, for one).

## Scopes

The token carries every Scope the API client holds. A process that only
reads can ask for less:

```ts sample=auth-scopes
import TeachMeHipaa from "@teachmehipaa/node";

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

| Scope               | Grants                                              |
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

A missing Scope rejects with `PermissionDeniedError` (403). The
[resource reference](../reference/resources.md) lists each method's Scopes.

## Environments

| `environment`      | Base URL                                  |
| ------------------ | ----------------------------------------- |
| `"live"` (default) | `https://api.tme.so/v1`                   |
| `"sandbox"`        | `https://api-teachmehipaa-dev.web.app/v1` |

Credentials belong to one Environment and fail in the other. `baseUrl`
replaces the URL, for a mock server or a proxy. `auth.introspect()` reports
`mode: "test"` for a Sandbox token and `"live"` otherwise.

## The Organization binding

An API client belongs to one Organization, so no method takes an
Organization id. The client calls `auth.introspect` once to learn it. Pass
`organizationId` when you already know it and the lookup never happens:

```ts sample=organization
import TeachMeHipaa from "@teachmehipaa/node";

const client = new TeachMeHipaa({
  clientId: process.env.TMH_CLIENT_ID!,
  clientSecret: process.env.TMH_CLIENT_SECRET!,
  organizationId: "org_acme",
});

const compliance = await client.compliance.retrieve();
console.log(compliance.lastResponse.requestId);
```

## Bringing your own token

`tokenProvider` replaces client credentials. `staticTokenProvider` wraps a
token you minted elsewhere:

```ts sample=auth-static-token
import TeachMeHipaa, { staticTokenProvider } from "@teachmehipaa/node";

const client = new TeachMeHipaa({
  tokenProvider: staticTokenProvider(process.env.TMH_ACCESS_TOKEN!),
  environment: "sandbox",
  organizationId: "org_acme",
});

const member = await client.members.retrieve("sub_01JD80AB2C3D4E5F6G7H8J9K0M");
console.log(member.lastResponse.status);
```

A static token never renews; after it expires, calls reject with
`AuthenticationError`. For rotating tokens, implement `TokenProvider`:
`getAccessToken()` resolves the current token, and the client calls
`invalidate(token)` after the API rejects it.

## Public methods

`courses.list`, `courses.retrieve` and `certificateVerifications.retrieve`
send no Access token. A client without credentials can call those three:

```ts sample=public-lookups
import TeachMeHipaa from "@teachmehipaa/node";

const client = new TeachMeHipaa({ environment: "sandbox" });

const verification = await client.certificateVerifications.retrieve("aB3dE9");
console.log(verification.status, verification.learnerName);

const courses = await client.courses.list();
console.log(courses.items.map((course) => course.title));
```

Any other method on it rejects with a `TypeError` before sending. Passing
`clientId` without `clientSecret`, or the reverse, throws at construction.

## Options

```ts sample=configuration
import TeachMeHipaa from "@teachmehipaa/node";

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

| Option           | Default                          | Effect                                                   |
| ---------------- | -------------------------------- | -------------------------------------------------------- |
| `clientId`       | None (public methods only)       | API client id, `cli_…`                                   |
| `clientSecret`   | Required with `clientId`         | API client secret, `tmh_cs_…`                            |
| `scopes`         | Every Scope the API client holds | Narrows the Access token                                 |
| `tokenProvider`  | Client credentials               | Supplies Access tokens instead                           |
| `environment`    | `"live"`                         | `"live"` or `"sandbox"`                                  |
| `baseUrl`        | The Environment's URL            | Overrides the URL                                        |
| `organizationId` | Looked up with `auth.introspect` | The Organization to act for                              |
| `maxRetries`     | `2`                              | Retries of a failed call that is safe to replay          |
| `timeout`        | `80000`                          | Milliseconds to wait for each response                   |
| `appInfo`        | None                             | `{ name, version?, url? }`, appended to the `User-Agent` |
| `logger`         | None                             | Receives one entry per response; see [Logging](#logging) |
| `fetch`          | `globalThis.fetch`               | The `fetch` requests go through                          |
| `transport`      | A `fetch` transport              | Replaces the HTTP layer; see [Testing](testing.md)       |
| `clock`          | Real time                        | `now()` and `sleep(ms)`, for tests                       |

Give `clientId` with `clientSecret`, or `tokenProvider`, or neither. Give
`fetch` or `transport`, never both. An unknown option or a bad value throws a
`TypeError` starting `teachmehipaa:` at construction, so a typo fails at
startup.

## Custom fetch

A `fetch` you pass carries every request, the token request included, while
the client keeps handling tokens, retries and errors:

```ts sample=configuration-fetch
import TeachMeHipaa from "@teachmehipaa/node";

const client = new TeachMeHipaa({
  clientId: process.env.TMH_CLIENT_ID!,
  clientSecret: process.env.TMH_CLIENT_SECRET!,
  environment: "sandbox",
  fetch: (input, init) => {
    console.log("sending", init?.method, String(input));
    return fetch(input, init);
  },
});
console.log(typeof client.learners.list);
```

For a proxy on Node's built-in `fetch`, wrap it and add
`dispatcher: new ProxyAgent(url)` from `undici` to `init`.

## Logging

The library prints nothing on its own. A `logger` gets one `debug` entry per
HTTP response, token requests included:

```ts sample=logging
import TeachMeHipaa from "@teachmehipaa/node";

const client = new TeachMeHipaa({
  clientId: process.env.TMH_CLIENT_ID!,
  clientSecret: process.env.TMH_CLIENT_SECRET!,
  organizationId: "org_acme",
  logger: console,
});

await client.learners.list();
```

Anything with `debug(message, fields)` works: `console`, `pino`, `winston`.
`fields` holds `method`, `path`, `status`, `latencyMs` and `requestId`. The
path drops its query string, which can contain Learner emails. Bodies and
credentials are never logged. `appInfo` is the only thing the library reports
about your software, through the `User-Agent`.
