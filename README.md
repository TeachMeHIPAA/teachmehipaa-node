# teachmehipaa

Official Node.js and TypeScript library for the TeachMeHIPAA Developer API.

[![CI](https://github.com/TeachMeHIPAA/teachmehipaa-node/actions/workflows/ci.yml/badge.svg)](https://github.com/TeachMeHIPAA/teachmehipaa-node/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Documentation

**[docs.teachmehipaa.com/api](https://docs.teachmehipaa.com/api?lang=node)**
has the API reference with Node.js samples for every operation, plus guides
for authentication, pagination, errors and webhooks.

## Install

```sh
npm install teachmehipaa
```

## Requirements

Node.js 20 or newer. The package ships ESM and CommonJS with bundled types
and has no runtime dependencies. It holds a client secret, so use it on a
server, never in a browser.

## Usage

```ts sample=quickstart
import TeachMeHipaa from "teachmehipaa";

const client = new TeachMeHipaa({
  clientId: process.env.TMH_CLIENT_ID!,
  clientSecret: process.env.TMH_CLIENT_SECRET!,
  environment: "sandbox",
});

for await (const item of client.learners.list({ status: "in_progress" })) {
  console.log(item.email);
}
```

`TMH_CLIENT_ID` (`cli_…`) and `TMH_CLIENT_SECRET` (`tmh_cs_…`) come from an
API client you create in the TeachMeHIPAA console. The `sandbox` Environment
(`https://sandbox.api.tme.so/v1`) never emails Learners, so start there.
Runnable programs live in [`examples/`](examples/README.md).

## Support

<!-- TODO(Nick): confirm the support address before launch. -->

Contact TeachMeHIPAA support with the `requestId` from the error or from
`lastResponse`. Changes are in the [changelog](CHANGELOG.md).

## Security

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) covers working on the library.

## License

[MIT](LICENSE)
