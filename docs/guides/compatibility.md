# Compatibility

## Module formats

`package.json` has one `exports` entry with `import` and `require`
conditions, each with its own types: `dist/index.js` with `index.d.ts`, and
`dist/index.cjs` with `index.d.cts`. ESM code imports the default or the
named export:

```ts sample=esm-imports
import TeachMeHipaa, { NotFoundError, webhooks } from "teachmehipaa";

console.log(typeof TeachMeHipaa, typeof NotFoundError, typeof webhooks);
```

CommonJS code requires the named export, or `.default`:

```js sample=commonjs
const { TeachMeHipaa } = require("teachmehipaa");

const client = new TeachMeHipaa({ environment: "sandbox" });

client.courses
  .retrieve("hipaa-2026")
  .then((course) => console.log(course.title));
```

`npm run check:dist` loads the build both ways and runs the sample above
against it. The package sets `"sideEffects": false`, so bundlers can drop what
you don't import.

## TypeScript

The declarations resolve under every `moduleResolution`: `node16` and
`nodenext` pick the `.d.ts` or `.d.cts` by condition, `bundler` reads the
`import` types, and `node10` falls back to the top-level `types` field.

Enums are open: a field typed `LearnerStatus` lists the known values for
completion and still accepts any string, so a value the API adds later type-
checks. Each `switch` therefore needs a `default`:

```ts sample=open-enums
const learner = await client.learners.retrieve(
  "sub_01JD80AB2C3D4E5F6G7H8J9K0M",
);
switch (learner.status) {
  case "compliant":
  case "expiring_soon":
    console.log("trained");
    break;
  case "not_started":
  case "in_progress":
    console.log("in training");
    break;
  default:
    console.log("needs attention:", learner.status);
}
```

`client` here is the one from [The client](client.md). Response objects also
keep fields the API added after your version, at runtime though not in the
types.

## Runtimes

| Runtime        | Status                                                     |
| -------------- | ---------------------------------------------------------- |
| Node.js 20, 22 | Supported (`engines` is `>=20`); CI runs the suite on both |
| Bun, Deno      | Load and run the package; not covered by CI                |
| Browsers       | Unsupported. The client holds a secret                     |

The library calls the global `fetch`, Web Crypto and `crypto.randomUUID` from
`node:crypto`. It imports `node:fs/promises` only when you pass a file path
to an upload. It has no runtime dependencies.

## Versioning

Releases follow [semantic versioning](https://semver.org/). Patch releases
fix bugs. Minor releases add methods, options, fields, Event types and enum
values. Major releases may remove or rename, with migration notes in the
[changelog](../../CHANGELOG.md). Before 1.0.0, any release may break.

`OPENAPI_VERSION` at the repository root names the Developer API document
release the resources and models were generated from, and the changelog
repeats it per release. The API changes by addition: new endpoints, optional
fields, enum values, error codes and Event types. Open enums, kept unknown
fields, `UnknownEvent` and a raw error `code` mean none of those break code
compiled against an older version.
