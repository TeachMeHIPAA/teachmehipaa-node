# Configuration

Every option is passed when you create the client, and fixed from then on.
To change one, create another client.

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

## Options

| Option           | Default                               | Description                                                                    |
| ---------------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| `clientId`       | None: public methods only             | Your API client's id (`cli_…`)                                                 |
| `clientSecret`   | (required with `clientId`)            | The matching secret (`tmh_cs_…`)                                               |
| `scopes`         | Every Scope the API client holds      | Narrows the Access token's Scopes                                              |
| `tokenProvider`  | Client credentials                    | Supplies Access tokens instead, e.g. `staticTokenProvider`                     |
| `environment`    | `"live"`                              | `"live"` or `"sandbox"`; credentials work only in their own Environment        |
| `baseUrl`        | The Environment's URL                 | Overrides it, e.g. to point at a mock server                                   |
| `organizationId` | Looked up once with `auth.introspect` | The Organization to act for                                                    |
| `maxRetries`     | `2`                                   | Retries of a failed call that is safe to replay                                |
| `timeout`        | `80000`                               | Milliseconds to wait for each response                                         |
| `appInfo`        | None                                  | `{ name, version?, url? }` of your software, sent in the `User-Agent`          |
| `logger`         | None                                  | Opt-in request logging; see [Logging](#logging)                                |
| `fetch`          | `globalThis.fetch`                    | A `fetch` to send requests with, e.g. one with a proxy dispatcher              |
| `transport`      | A `fetch` transport                   | Replaces the HTTP layer entirely, e.g. with a fake in tests (not with `fetch`) |
| `clock`          | Real time                             | Supplies the time and sleeps, for tests                                        |

Give `clientId` and `clientSecret`, or a `tokenProvider`, or neither for a
client that can only make [public lookups](authentication.md#public-lookups-without-credentials).
Give `fetch` or `transport`, not both.

The client checks its options when you create it. An unknown option, such as
a misspelled one, or an invalid value throws a `TypeError` whose message
starts with `teachmehipaa:`, so a typo fails fast instead of being ignored.

## Timeouts and retries

`timeout` bounds the wait for each response, in milliseconds; a call that
times out rejects with `TimeoutError` after any retries. `maxRetries` sets how
many times a failed call that is safe to replay is retried. Both can be
overridden for one call with [request options](errors-and-retries.md#request-options):

```ts sample=configuration-per-call
const page = await client.learners.list(
  { limit: 100 },
  { timeout: 5_000, maxRetries: 0 },
);
console.log(page.items.length);
```

`timeout` covers each attempt, not the whole call: with retries, a call can
take longer than `timeout` in all. `Operation.wait()` has its own `timeout`;
see [Operations and files](operations-and-files.md).

## Identifying your software

`appInfo` adds your software's name, and optionally its version and URL, to
the `User-Agent` header, which helps TeachMeHIPAA support find your requests.
The `User-Agent` is the only thing the library says about its caller: it
sends no telemetry and writes nothing to disk.

## Custom `fetch`

The library sends requests with the global `fetch`. Pass your own `fetch` to
change how requests leave your process, such as through a proxy, while the
library keeps handling tokens, retries and errors:

```ts sample=configuration-fetch
import TeachMeHipaa from "teachmehipaa";

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

With Node's built-in `fetch`, a proxy is an undici dispatcher: wrap `fetch`
to pass `dispatcher: new ProxyAgent(url)` in `init`.

## Logging

The library writes nothing to the console, sends no telemetry and writes
nothing to disk. Pass a `logger` to get one entry per HTTP response, token
requests included, with the method, path (without its query string, which can
hold Learner emails), status, latency and request id. Request and response
bodies and credentials are never logged, because they hold Learner details.

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
`winston` logger. Each entry's `fields` are:

| Field       | Example                                 |
| ----------- | --------------------------------------- |
| `method`    | `"GET"`                                 |
| `path`      | `"/v1/organizations/org_acme/learners"` |
| `status`    | `200`                                   |
| `latencyMs` | `112`                                   |
| `requestId` | `"req_…"`, or `null`                    |

## Supported runtimes

Node.js 20 and newer. Bun and Deno work too, since the library uses only
`fetch`, Web Crypto, `node:crypto` and, to read uploads from a file path,
`node:fs`. It is server-only: your client secret must never reach a browser.
