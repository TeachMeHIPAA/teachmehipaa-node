import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import TeachMeHipaa, { type Uploadable } from "../src/index.js";
import { createFakeClock } from "./support/fake-clock.js";
import {
  createFakeTransport,
  type FakeTransport,
} from "./support/fake-transport.js";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  ORG_ID,
  TOKEN_ROUTE,
  tokenReply,
} from "./support/fixtures.js";
import type { TransportRequest } from "../src/index.js";

const ROUTE = `POST /v1/organizations/${ORG_ID}/enrollments:import`;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** RFC 4180 with CRLF, a quoted comma and non-ASCII UTF-8. */
const CSV_TEXT =
  'email,name\r\nana@example.com,"Example, Ana"\r\njose@example.com,José Núñez\r\n';
const CSV = new TextEncoder().encode(CSV_TEXT);

/** `dev#/components/schemas/ImportPreview`. */
const previewBody = {
  totalRows: 2,
  validRows: 2,
  seatsRequired: 2,
  seatsAvailable: 10,
  rows: [
    { rowNumber: 2, email: "ana@example.com", status: "valid" },
    { rowNumber: 3, email: "jose@example.com", status: "valid" },
  ],
};

/** `dev#/components/schemas/Operation`, as a commit returns it (202). */
const operationBody = {
  name: "op_01JD8H",
  kind: "enrollments.import",
  done: false,
};

const clientOn = (fake: FakeTransport) =>
  new TeachMeHipaa({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    organizationId: ORG_ID,
    transport: fake.transport,
    clock: createFakeClock(),
  });

/** The multipart parts as the API would read them. */
const partsOf = async (request: TransportRequest | undefined) => {
  const body = request?.body;
  if (!(body instanceof FormData)) {
    throw new Error("Expected a multipart body");
  }
  const file = body.get("file");
  const options = body.get("options");
  if (!(file instanceof Blob) || !(options instanceof Blob)) {
    throw new Error("Expected a file part and an options part");
  }
  return {
    names: [...body.keys()],
    file: {
      type: file.type,
      bytes: [...new Uint8Array(await file.arrayBuffer())],
    },
    options: {
      type: options.type,
      json: JSON.parse(await options.text()) as unknown,
    },
  };
};

const chunks = [CSV.slice(0, 7), CSV.slice(7, 40), CSV.slice(40)];

const webStream = () =>
  new ReadableStream<Uint8Array>({
    start: (controller) => {
      chunks.forEach((chunk) => {
        controller.enqueue(chunk);
      });
      controller.close();
    },
  });

describe("Enrollment CSV import", () => {
  const directory = { path: "" };

  beforeAll(async () => {
    directory.path = await mkdtemp(join(tmpdir(), "tmh-import-"));
    await writeFile(join(directory.path, "roster.csv"), CSV);
  });

  afterAll(async () => {
    await rm(directory.path, { recursive: true, force: true });
  });

  it("previews the file as a CSV part and a JSON options part", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(ROUTE, { json: previewBody });

    const preview = await clientOn(fake).enrollments.previewImport({
      file: CSV,
      options: { courseId: "hipaa-2026" },
    });

    expect(preview).toEqual(previewBody);
    expect(await partsOf(fake.requestsTo(ROUTE)[0])).toEqual({
      names: ["file", "options"],
      file: { type: "text/csv", bytes: [...CSV] },
      options: {
        type: "application/json",
        json: { courseId: "hipaa-2026", validateOnly: true },
      },
    });
  });

  const sources: readonly [string, () => Uploadable][] = [
    ["a file path", () => join(directory.path, "roster.csv")],
    ["a Uint8Array", () => CSV],
    ["an ArrayBuffer", () => CSV.slice().buffer],
    ["a Blob", () => new Blob([CSV], { type: "application/octet-stream" })],
    ["a web ReadableStream", webStream],
    ["a Node Readable", () => Readable.from(chunks)],
  ];

  it.each(sources)(
    "imports from %s, sending the bytes unchanged with an Idempotency-Key",
    async (_, source) => {
      const fake = createFakeTransport()
        .script(TOKEN_ROUTE, tokenReply())
        .script(ROUTE, { status: 202, json: operationBody });

      const operation = await clientOn(fake).enrollments.import({
        file: source(),
      });

      expect(operation).toEqual(operationBody);
      const [request] = fake.requestsTo(ROUTE);
      expect(request?.headers["idempotency-key"]).toMatch(UUID_V4);
      expect(await partsOf(request)).toEqual({
        names: ["file", "options"],
        file: { type: "text/csv", bytes: [...CSV] },
        options: { type: "application/json", json: { validateOnly: false } },
      });
    },
  );

  it("resends identical bytes and the same Idempotency-Key when a streamed import is retried", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        ROUTE,
        {
          status: 503,
          headers: { "content-type": "application/problem+json" },
          json: {
            title: "Unavailable",
            status: 503,
            code: "temporarily_unavailable",
          },
        },
        { status: 202, json: operationBody },
      );

    await clientOn(fake).enrollments.import({ file: Readable.from(chunks) });

    const [first, retry] = fake.requestsTo(ROUTE);
    expect(retry).toBeDefined();
    expect(retry?.headers["idempotency-key"]).toBe(
      first?.headers["idempotency-key"],
    );
    expect((await partsOf(retry)).file.bytes).toEqual([...CSV]);
    expect((await partsOf(first)).file.bytes).toEqual([...CSV]);
  });

  it("refuses CSV text passed as a string, which is taken as a path", async () => {
    const fake = createFakeTransport().script(TOKEN_ROUTE, tokenReply());

    await expect(
      clientOn(fake).enrollments.previewImport({ file: CSV_TEXT }),
    ).rejects.toThrow(TypeError);
    expect(fake.requestsTo(ROUTE)).toEqual([]);
  });
});
