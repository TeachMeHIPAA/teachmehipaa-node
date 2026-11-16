# @teachmehipaa/node

TypeScript client for the TeachMeHIPAA Developer API. Ships ESM and CommonJS
for Node.js 20+, with no runtime dependencies.

[![CI](https://github.com/TeachMeHIPAA/teachmehipaa-node/actions/workflows/ci.yml/badge.svg)](https://github.com/TeachMeHIPAA/teachmehipaa-node/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> [!IMPORTANT]

## Install

```sh
npm install @teachmehipaa/node
```

## Usage

```ts sample=quickstart
import TeachMeHipaa from "@teachmehipaa/node";

const client = new TeachMeHipaa({
  clientId: process.env.TMH_CLIENT_ID!,
  clientSecret: process.env.TMH_CLIENT_SECRET!,
  environment: "sandbox",
});

const learner = await client.learners.retrieve(
  "sub_01JD80AB2C3D4E5F6G7H8J9K0M",
);
console.log(learner.name, learner.status);

for await (const item of client.learners.list({ status: "in_progress" })) {
  console.log(item.email);
}
```

`TMH_CLIENT_ID` (`cli_…`) and `TMH_CLIENT_SECRET` (`tmh_cs_…`) come from an
API client you create in the TeachMeHIPAA console. Sandbox Learners never get
email, so start there.

## At a glance

|              |                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------- |
| Modules      | ESM and CommonJS from one `exports` map; `import TeachMeHipaa` or `require("@teachmehipaa/node")` |
| Types        | Bundled `.d.ts` and `.d.cts`, generated from the OpenAPI document; enums stay open                |
| Runtime      | Node.js 20 and newer, tested on 20 and 22. Bun and Deno load it too                               |
| Server-only  | It holds a client secret, so it has no browser build                                              |
| Dependencies | None at runtime. HTTP is the global `fetch`; signatures use Web Crypto                            |
| Timeouts     | 80 s per attempt by default, set per client or per call. `AbortSignal` stops polling loops        |
| Lists        | `for await` walks every page lazily; `autoPagingToArray({ limit })` collects up to 10,000         |
| Retries      | 2 by default, with backoff, on network errors, 409 `conflict`, 429 and 5xx                        |
| Idempotency  | Each POST and PUT that takes one gets a generated `Idempotency-Key`, reused on retries            |
| Webhooks     | `webhooks.constructEvent` verifies a Delivery from Express, a fetch handler or `node:http`        |
| Privacy      | No telemetry. Logging is opt-in and never includes bodies or credentials                          |

## Guides

- [The client](docs/guides/client.md): credentials, Scopes, Environments,
  every option, custom `fetch`, logging.
- [Errors and retries](docs/guides/errors.md): error classes, `code`,
  timeouts, retry rules, request options.
- [Writes](docs/guides/writes.md): create or upsert, idempotency keys, ETags,
  merge patches.
- [Lists and the Event log](docs/guides/pagination.md): `for await`, pages,
  tailing Events with an `AbortSignal`.
- [Operations and files](docs/guides/operations.md): `wait()`, CSV exports and
  imports, PDFs, bulk changes.
- [Webhooks](docs/guides/webhooks.md): subscriptions and verifying Deliveries.
- [Testing](docs/guides/testing.md): a fake `transport`, mock servers, signed
  test Deliveries.
- [Compatibility](docs/guides/compatibility.md): module formats, runtimes,
  versioning.

Reference: [every method](docs/reference/resources.md) with its route and
Scopes, the [TypeDoc site](https://teachmehipaa.github.io/teachmehipaa-node/),
and [runnable examples](examples/README.md). The [docs index](docs/README.md)
lists everything, design records included.

## Support

<!-- TODO(Nick): confirm the support address before launch. -->

Contact TeachMeHIPAA support with the `requestId` from the error or from
`lastResponse`. Report vulnerabilities privately as described in
[SECURITY.md](SECURITY.md). Changes are in the [changelog](CHANGELOG.md);
[CONTRIBUTING.md](CONTRIBUTING.md) covers working on the library.
[MIT](LICENSE) licensed.
