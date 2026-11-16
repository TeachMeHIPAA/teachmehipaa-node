# Operations and files

Samples use the `client` from [The client](client.md).

## `wait()`

Exports, imports, `learners.batchUpsert`, `enrollments.batchByFilter`, Test
deliveries and redrives finish after their request returns. They resolve an
`Operation`: `done` flips to `true` when the work ends, and then `response`
holds the result or `error` holds the problem.

```ts sample=operations
const operation = await client.learners.export({
  format: "csv",
  courseId: "hipaa-2026",
});
const done = await operation.wait({ timeout: 60_000, interval: 2_000 });
const { csv, filename, rowCount } = done.exportResult();
console.log(filename, rowCount, csv.length);
```

| `wait()` option | Default | Effect                                                           |
| --------------- | ------- | ---------------------------------------------------------------- |
| `timeout`       | 300000  | Milliseconds to wait in total                                    |
| `interval`      | 1000    | Milliseconds before the first poll; later polls back off to 10 s |
| `signal`        | None    | An `AbortSignal`; aborting rejects with the signal's reason      |

An Operation that ends in error rejects with `OperationFailedError`, carrying
`code` and `detail` like any API error. One still running at the timeout
rejects with `OperationTimeoutError`. Both expose `operation`, so you can
call `wait()` again.

## Resuming from another process

An Operation's `name` identifies it. Store it, and fetch the Operation later
with `operations.retrieve`. `jobs` stands for your storage:

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

## CSV exports

`learners.export`, `enrollments.export` and `certificates.export` produce RFC
4180 CSV with CRLF line endings and a header row. `exportResult()` decodes it
to a string and adds a suggested `filename` and `rowCount` (data rows only).
Call it before `done` is `true` and it throws a `TypeError`.
[`examples/export-certificates.ts`](../../examples/export-certificates.ts)
writes the file to disk.

## CSV imports

`enrollments.import` invites everyone in a CSV with an `email` column and
optional `name` and `courseId` columns, 500 rows at most.
`enrollments.previewImport` reports what each row would do, inviting nobody:

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

`file` accepts a path string, a `Uint8Array` or `ArrayBuffer`, a `Blob`, a web
`ReadableStream` or a Node `Readable`. A string always means a path; wrap CSV
text in `new Blob([text])`. The content is read once, so retries resend the
same bytes.

## Certificate PDFs

`certificates.downloadPdf` resolves `data` (a `Uint8Array`), `contentType` and
`filename`. Pass `asStream: true` for a web `ReadableStream` in `stream`
instead, and pipe it with `Readable.fromWeb`:

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

With `asStream`, retries and `timeout` cover the response headers only; a
failure mid-body surfaces from the stream. Revoked and expired Certificates
come back watermarked.

## Bulk changes

Each record in a bulk call succeeds or fails on its own.

| Method                      | Acts on                                 | Resolves                   |
| --------------------------- | --------------------------------------- | -------------------------- |
| `learners.batchUpsert`      | Up to 500 Learners, created or found    | An `Operation`             |
| `enrollments.batch`         | Up to 500 Enrollments, by id            | Per-record results at once |
| `enrollments.batchByFilter` | Up to 500 Enrollments matching a filter | An `Operation`             |

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

`outcome` is `succeeded`, `skipped` or `failed`; a failed result carries its
`problem`.
