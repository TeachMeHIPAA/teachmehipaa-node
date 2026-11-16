# TeachMeHIPAA Node.js Library

The official Node.js and TypeScript library for the TeachMeHIPAA Developer API.

[![CI](https://github.com/TeachMeHIPAA/teachmehipaa-node/actions/workflows/ci.yml/badge.svg)](https://github.com/TeachMeHIPAA/teachmehipaa-node/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> [!IMPORTANT]
> **Status: pre-release.** The TeachMeHIPAA Developer API isn't generally
> available yet, and this package isn't published to npm. Until it is,
> install it from source as shown below. Names and behavior may still change
> before 1.0.

Enroll your people in HIPAA training and track their compliance from your own
systems. The library handles Access tokens, the Organization binding,
retries, idempotency keys, typed errors, pagination, ETags, Operations and
webhook verification, so your code only calls methods.

## Installation

Build the package from a checkout, then install the tarball in your project:

```sh
git clone https://github.com/TeachMeHIPAA/teachmehipaa-node.git
cd teachmehipaa-node
npm ci
npm run build
npm pack   # writes teachmehipaa-0.0.0.tgz

cd ../your-project
npm install ../teachmehipaa-node/teachmehipaa-0.0.0.tgz
```

The package has no runtime dependencies. It ships ESM and CommonJS builds with
TypeScript types, so `import` and `require` both work. It needs Node.js 20 or
newer; Bun and Deno work too.

## Quickstart

Create an API client in the TeachMeHIPAA console to get a client id (`cli_…`)
and secret (`tmh_cs_…`). Start in the Sandbox Environment, where no real
Learners are emailed.

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

for await (const item of client.learners.list({ status: "in_progress" })) {
  console.log(item.email);
}
```

Every method is async and takes its parameters first and request options
last. The client gets and renews Access tokens itself, and retries failures
that are safe to retry. [Getting started](docs/guides/getting-started.md) walks
through your first integration.

## Documentation

| Topic                                                                | What it covers                                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Getting started](docs/guides/getting-started.md)                    | Install, credentials, first calls, inviting a Learner                            |
| [Authentication](docs/guides/authentication.md)                      | Client credentials, Scopes, Environments, the Organization binding, public calls |
| [Errors and retries](docs/guides/errors-and-retries.md)              | Error classes, `code`, request ids, retries, idempotency, request options        |
| [Pagination and the Event log](docs/guides/pagination-and-events.md) | Auto-paging, the Event log, tailing it                                           |
| [Webhooks](docs/guides/webhooks.md)                                  | Webhook subscriptions, verifying Deliveries, Test deliveries                     |
| [Operations and files](docs/guides/operations-and-files.md)          | Waiting on Operations, CSV exports and imports, Certificate PDFs, bulk changes   |
| [Conditional requests](docs/guides/conditional-requests.md)          | ETags, `ifMatch`, `ifNoneMatch`, merge-patch updates                             |
| [Testing](docs/guides/testing.md)                                    | The Sandbox, faking the transport, signing test Deliveries                       |
| [Configuration](docs/guides/configuration.md)                        | Every client option, logging, timeouts                                           |
| [Versioning](docs/guides/versioning.md)                              | Semantic versioning, `OPENAPI_VERSION`, additive API changes                     |

- [Resource reference](docs/reference/resources.md): every resource and
  method, with its HTTP route, Scopes and return type.
- [API reference](https://teachmehipaa.github.io/teachmehipaa-node/): every
  exported class, function and type, built with TypeDoc.
- [Examples](examples/README.md): small programs to run against the Sandbox.
- [All documentation](docs/README.md), including the design records.

## Support and security

<!-- TODO(Nick): confirm the support address before launch. -->

For help, contact TeachMeHIPAA support and quote the `requestId` from the
error or `lastResponse`. To report a vulnerability, see
[SECURITY.md](SECURITY.md); please don't open a public issue.

The library sends no telemetry and never logs request or response bodies. See
the [changelog](CHANGELOG.md) for what changed, and
[CONTRIBUTING.md](CONTRIBUTING.md) to work on the library. It is released
under the [MIT License](LICENSE).
