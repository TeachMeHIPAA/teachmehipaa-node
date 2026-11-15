import { describe, expect, it } from "vitest";
import { ApiError, NotFoundError } from "../src/index.js";
import { clientOn } from "./support/client.js";
import { createFakeTransport } from "./support/fake-transport.js";
import { ORG_ID, TOKEN_ROUTE, tokenReply } from "./support/fixtures.js";

const CERTIFICATE_ID = "cert_01JD8F";
const ROUTE = `GET /v1/organizations/${ORG_ID}/certificates/${CERTIFICATE_ID}/content`;

/** Every byte value, so any text decoding along the way would show. */
const EVERY_BYTE = Uint8Array.from({ length: 256 }, (_, index) => index);

const pdfReply = {
  headers: {
    "content-type": "application/pdf",
    "content-disposition": 'attachment; filename="certificate-ana.pdf"',
  },
  bytes: EVERY_BYTE,
};

describe("Certificate PDF download", () => {
  it("returns every byte 0x00-0xFF unchanged, with content type and filename", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(ROUTE, pdfReply);

    const file = await clientOn(fake).certificates.downloadPdf(CERTIFICATE_ID);

    expect(file.data).toBeInstanceOf(Uint8Array);
    expect([...file.data]).toEqual([...EVERY_BYTE]);
    expect(file.contentType).toBe("application/pdf");
    expect(file.filename).toBe("certificate-ana.pdf");
    expect(fake.requestsTo(ROUTE)[0]?.headers.accept).toContain(
      "application/pdf",
    );
  });

  it("raises the typed error for a problem+json response", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(ROUTE, {
        status: 404,
        headers: {
          "content-type": "application/problem+json",
          "x-request-id": "req_missing",
        },
        json: {
          title: "Not found",
          status: 404,
          code: "not_found",
          detail: "No such certificate.",
        },
      });

    const download = clientOn(fake).certificates.downloadPdf(CERTIFICATE_ID);

    await expect(download).rejects.toBeInstanceOf(NotFoundError);
    await expect(download).rejects.toMatchObject({
      code: "not_found",
      requestId: "req_missing",
    });
  });
});

describe("Certificate PDF download as a stream", () => {
  const readAll = async (
    stream: ReadableStream<Uint8Array>,
  ): Promise<number[]> => [
    ...new Uint8Array(await new Response(stream).arrayBuffer()),
  ];

  it("hands back a web ReadableStream of the unchanged bytes", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(ROUTE, pdfReply);

    const file = await clientOn(fake).certificates.downloadPdf(CERTIFICATE_ID, {
      asStream: true,
    });

    expect(file.stream).toBeInstanceOf(ReadableStream);
    expect(file.contentType).toBe("application/pdf");
    expect(file.filename).toBe("certificate-ana.pdf");
    expect(file.lastResponse.status).toBe(200);
    expect(await readAll(file.stream)).toEqual([...EVERY_BYTE]);
  });

  it("raises an ApiError for a 200 HTML page before handing back any stream", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(ROUTE, {
        headers: { "content-type": "text/html" },
        body: "<!doctype html><title>Not found</title>",
      });

    await expect(
      clientOn(fake).certificates.downloadPdf(CERTIFICATE_ID, {
        asStream: true,
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
