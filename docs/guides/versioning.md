# Versioning

## Semantic versioning

The library follows [semantic versioning](https://semver.org/). Within one
major version, upgrading never breaks code that compiled and ran against an
earlier minor or patch release:

- **Patch** releases fix bugs.
- **Minor** releases add methods, options, fields, Event types and enum
  values.
- **Major** releases may remove or rename things, and say how to migrate in
  the [changelog](../../CHANGELOG.md).

Until 1.0.0, the library is pre-release and any release may change its
interface.

## Which API version a release covers

Resources and models are generated from the Developer API's OpenAPI document.
The `OPENAPI_VERSION` file at the root of the repository names the document
release a library version was generated from, and the changelog repeats it
for each release. A method or field the API added after that release appears
in a later library version.

## Additive API changes

The Developer API grows by addition: new endpoints, new optional fields, new
enum values, new error codes and new Event types. The library is built so
that none of these break you, even before you upgrade:

- **Unknown response fields are kept.** A field the API added is on the
  object at runtime, though not in its type until you upgrade.
- **Enums are open.** A status or other enum field accepts values this
  version doesn't list. The types list the known values for completion, and
  still allow any string.
- **Unknown Event types parse.** A webhook Delivery of a type this version
  doesn't know arrives as an `UnknownEvent`, with its `eventType` and `data`
  as sent.
- **New error codes reach you.** An error's `code` is whatever the API sent,
  and the error class still follows the HTTP status.

So always keep a fallback when you branch on an enum, an Event type or an
error code:

```ts sample=versioning-open-enums
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

Here `client` is created as in [Getting started](getting-started.md).

## Supported Node.js versions

The library supports Node.js 20 and newer (the `engines` field of
`package.json`). CI tests it on Node.js 20 and 22.
