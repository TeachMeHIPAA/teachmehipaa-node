# Examples

Small programs that use the library against the Sandbox Environment. Each
reads your Sandbox API client's credentials from `TMH_CLIENT_ID` and
`TMH_CLIENT_SECRET`.

| Example                                            | What it does                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`quickstart.ts`](quickstart.ts)                   | Prints the Compliance summary and the first five Learners                    |
| [`sync-roster.ts`](sync-roster.ts)                 | Syncs a roster by External ID, then lists Learners no longer on it           |
| [`webhook-server.ts`](webhook-server.ts)           | An Express endpoint that verifies Deliveries and looks up certified Learners |
| [`export-certificates.ts`](export-certificates.ts) | Exports every Certificate to a CSV file, waiting for the Operation           |

## Running them

From a checkout of this repository, build the library once, then run an
example with `tsx`, which the repository already installs:

```sh
npm ci
npm run build
export TMH_CLIENT_ID=cli_...
export TMH_CLIENT_SECRET=tmh_cs_...
npx tsx examples/quickstart.ts
```

The examples import `"teachmehipaa"` by name, which inside this repository
resolves to the build in `dist/`. In your own project, install the package
first (see [Getting started](../docs/guides/getting-started.md)) and copy an
example in.

`webhook-server.ts` also needs `TMH_WEBHOOK_SECRET`, the Signing secret of a
Webhook subscription pointed at it, and listens on `PORT` (3000 by default).
To receive Sandbox Deliveries on your machine, expose it with a tunnel and
send a Test delivery with `webhookSubscriptions.test`.

CI type-checks every example (`npm run typecheck` uses
`tsconfig.examples.json`) but never runs them.
