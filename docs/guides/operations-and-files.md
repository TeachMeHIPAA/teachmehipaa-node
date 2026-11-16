# Operations and files

Samples use a `client` created as in [Getting started](getting-started.md).

## Operations

Some work finishes after the request that started it returns: exports,
imports, bulk changes, Test deliveries and redrives. Those methods resolve
with an **Operation**. Its `done` says whether it has finished; once it has,
`response` holds the result, or `error` holds the problem.

`wait()` polls until the Operation is done and resolves with its final state.
An export's `exportResult()` then hands back the CSV file:

```ts sample=operations
const operation = await client.learners.export({
  format: "csv",
  courseId: "hipaa-2026",
});
const done = await operation.wait({ timeout: 60_000, interval: 2_000 });
const { csv, filename, rowCount } = done.exportResult();
console.log(filename, rowCount, csv.length);
```

| `wait()` option | Default   | Effect                                                               |
| --------------- | --------- | -------------------------------------------------------------------- |
| `timeout`       | 5 minutes | Milliseconds to wait in all before giving up                         |
| `interval`      | 1000      | Milliseconds before the first poll; later polls back off, up to 10 s |
| `signal`        | None      | An `AbortSignal` that stops waiting                                  |

An Operation that finished with an error rejects with `OperationFailedError`,
which carries the problem's `code` and `detail` like any API error. One still
running at the timeout rejects with `OperationTimeoutError`. Both carry the
`operation`, so you can wait on it again.

## Resume waiting on an Operation

An Operation's `name` identifies it. Save it, and later fetch the Operation
with `operations.retrieve`, such as from another process:

```ts sample=operations-resume
import { operationIdFromName } from "teachmehipaa";

const started = await client.certificates.export({ format: "csv" });
await jobs.save(started.name);

// Later, maybe in another process:
const operation = await client.operations.retrieve(
  operationIdFromName(await jobs.load()),
);
const done = await operation.wait();
console.log(done.exportResult().rowCount);
```

Here `jobs` stands in for your own storage.

## CSV exports

`learners.export`, `enrollments.export` and `certificates.export` each start
an export Operation. The finished CSV follows RFC 4180, with CRLF line endings
and a header row; `exportResult()` decodes it to a string, with a suggested
`filename` and the `rowCount` (data rows, not counting the header).
`exportResult()` throws a `TypeError` if you call it before the Operation is
done, so always `wait()` first.

The [certificate export example](../../examples/export-certificates.ts) writes
the file to disk.

## CSV imports

`enrollments.import` invites everyone in a CSV file with an `email` column,
and optional `name` and `courseId` columns, up to 500 rows.
`enrollments.previewImport` checks the same file first and reports, row by
row, what an import would do, without inviting anyone:

```ts sample=csv-import
const file = new Blob([
  "email,name\r\nana@example.com,Ana Example\r\nben@example.com,Ben Example\r\n",
]);

const preview = await client.enrollments.previewImport({
  file,
  options: { courseId: "hipaa-2026" },
});
console.log(preview.validRows, "of", preview.totalRows, "rows are valid");

if (preview.validRows === preview.totalRows) {
  const operation = await client.enrollments.import({
    file,
    options: { courseId: "hipaa-2026" },
  });
  await operation.wait();
}
```

`file` takes a file path, bytes (`Uint8Array` or `ArrayBuffer`), a `Blob`, a
web `ReadableStream` or a Node `Readable`. A string is always a file path, so
pass CSV text as `new Blob([text])`. The library reads the content once, so
retries send exactly the same bytes.

## Certificate PDFs

`certificates.downloadPdf` resolves with the PDF's bytes in `data`, along with
the `contentType` and `filename` the API sent. For large files, or to pass the
file straight through, pass `asStream: true` to get a web `ReadableStream`
instead:

```ts sample=pdf-download
import { createWriteStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const pdf = await client.certificates.downloadPdf("cert_01JD8F");
await writeFile(pdf.filename ?? "certificate.pdf", pdf.data);

const { stream } = await client.certificates.downloadPdf("cert_01JD8F", {
  asStream: true,
});
await pipeline(Readable.fromWeb(stream), createWriteStream("certificate.pdf"));
```

With `asStream`, retries and the `timeout` cover only getting the response
started; a failure while you read the stream surfaces from the stream.
Revoked and expired Certificates come back watermarked.

## Bulk changes

Three methods act on many records in one request, and each record succeeds or
fails on its own:

| Method                      | Acts on                                   | Returns                     |
| --------------------------- | ----------------------------------------- | --------------------------- |
| `learners.batchUpsert`      | Up to 500 Learners, each created or found | An Operation                |
| `enrollments.batch`         | Up to 500 Enrollments, by id              | The result of each, at once |
| `enrollments.batchByFilter` | Up to 500 Enrollments matching a filter   | An Operation                |

```ts sample=bulk-changes
const reminded = await client.enrollments.batch({
  operation: "remind",
  select: { enrollmentIds: ["enr_01", "enr_02"] },
});
for (const result of reminded.results) {
  console.log(result.enrollmentId, result.outcome);
}

const renewal = await client.enrollments.batchByFilter({
  operation: "recertify",
  select: { filter: { status: "EXPIRED", courseId: "hipaa-2026" } },
});
await renewal.wait();
```

An `enrollments.batch` result's `outcome` is `succeeded`, `skipped` or
`failed`; a failed one carries its `problem`.
