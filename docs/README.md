# Documentation

Start with the [README](../README.md): install and a working example. Then
pick the guide for the job.

## Guides

| Guide                                           | Read it for                                                   |
| ----------------------------------------------- | ------------------------------------------------------------- |
| [The client](guides/client.md)                  | Credentials, Scopes, Environments, every option, logging      |
| [Errors and retries](guides/errors.md)          | Error classes, `code`, retry rules, timeouts, request options |
| [Writes](guides/writes.md)                      | Create or upsert, idempotency keys, ETags, merge patches      |
| [Lists and the Event log](guides/pagination.md) | `for await`, pages, `events.tail` with an `AbortSignal`       |
| [Operations and files](guides/operations.md)    | `wait()`, CSV exports and imports, PDFs, bulk changes         |
| [Webhooks](guides/webhooks.md)                  | Subscriptions, `constructEvent`, Test deliveries              |
| [Testing](guides/testing.md)                    | Sandbox, a fake `transport`, mock servers, handler tests      |
| [Compatibility](guides/compatibility.md)        | ESM and CommonJS, TypeScript, runtimes, versioning            |

## Reference

- [Resource reference](reference/resources.md): each method's signature,
  route, Scopes, retry and idempotency behavior. Generated from the SDK IR.
- [`code-samples.json`](reference/code-samples.json): one runnable program per
  API operation, generated alongside it. The TeachMeHIPAA API reference shows
  these under "Node".
- [TypeDoc](https://teachmehipaa.github.io/teachmehipaa-node/): every exported
  class, function and type. `npm run docs` builds it into `site/`.

## Examples

[`examples/`](../examples/README.md) holds four programs that read
`TMH_CLIENT_ID` and `TMH_CLIENT_SECRET` and run against the Sandbox:

- [`quickstart.ts`](../examples/quickstart.ts): the Compliance summary and
  the first Learners.
- [`sync-roster.ts`](../examples/sync-roster.ts): a roster sync through
  `upsertByExternalId`.
- [`webhook-server.ts`](../examples/webhook-server.ts): an Express endpoint
  that verifies Deliveries.
- [`export-certificates.ts`](../examples/export-certificates.ts): a
  Certificate CSV export that waits on its Operation.

## For contributors

None of this is needed to use the library.

- [CONTRIBUTING.md](../CONTRIBUTING.md): setup, the generator, the test
  suites, how these docs are tested and built.
- [`adr/`](adr/): architecture decision records, such as
  [generated surface from a shared IR](adr/0001-generated-surface-from-shared-ir.md),
  [the Organization bound to the client](adr/0003-organization-bound-to-client.md),
  [webhook verification needs the path](adr/0005-webhook-verification-needs-the-path.md),
  [tolerant models and open enums](adr/0006-tolerant-models-open-enums.md) and
  [no telemetry, no body logging](adr/0007-no-telemetry-no-body-logging.md).
  Superseded records stay, marked as such.
- [`design/`](design/grilling-2026-11-15.md): the design review that settled
  the interface.
- [`research/`](research/stripe-node.md): notes on Stripe's Node.js library,
  whose conventions this one follows where they fit.
- [`agents/`](agents/domain.md): conventions for coding agents in this repo.
- [GLOSSARY.md](../GLOSSARY.md): Learner, Enrollment, Delivery and the other
  terms these docs use.
