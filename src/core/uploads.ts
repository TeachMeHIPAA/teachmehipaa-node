/**
 * File content for a multipart part, such as an Enrollment import's CSV: a
 * file path (read with `node:fs`, so Node, Bun or Deno), bytes, a `Blob`, a
 * web `ReadableStream` or a Node `Readable`. A string is always a path; pass
 * CSV text as `new Blob([text])`.
 */
export type Uploadable =
  | string
  | Uint8Array
  | ArrayBuffer
  | Blob
  | ReadableStream<Uint8Array>
  | AsyncIterable<Uint8Array | string>;

export interface BinaryPart {
  readonly name: string;
  readonly contentType: string;
}

const isAsyncIterable = (
  value: unknown,
): value is AsyncIterable<Uint8Array | string> =>
  typeof value === "object" && value !== null && Symbol.asyncIterator in value;

const readPath = async (path: string, name: string): Promise<Uint8Array> => {
  // A path never holds a line break; CSV text always does.
  if (/[\r\n]/.test(path)) {
    throw new TypeError(
      `TeachMeHipaa: ${name} was given text, but a string is a file path. Pass the content as a Blob or Uint8Array.`,
    );
  }
  // Imported on first use, so runtimes without node:fs can still load the
  // library as long as they don't upload from a path.
  const { readFile } = await import("node:fs/promises");
  return readFile(path);
};

const readIterable = async (
  iterable: AsyncIterable<Uint8Array | string>,
): Promise<readonly Uint8Array[]> => {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for await (const chunk of iterable) {
    chunks.push(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
  }
  return chunks;
};

/**
 * The whole content, read once per call: a stream can't be replayed, and a
 * retry must send exactly the bytes the first attempt did.
 */
const readUploadable = async (
  value: unknown,
  name: string,
): Promise<readonly (Uint8Array | ArrayBuffer | Blob)[]> => {
  if (typeof value === "string") {
    return [await readPath(value, name)];
  }
  if (
    value instanceof Uint8Array ||
    value instanceof ArrayBuffer ||
    value instanceof Blob
  ) {
    return [value];
  }
  if (value instanceof ReadableStream) {
    return [await new Response(value).arrayBuffer()];
  }
  if (isAsyncIterable(value)) {
    return readIterable(value);
  }
  throw new TypeError(
    `TeachMeHipaa: ${name} must be a file path, Uint8Array, ArrayBuffer, Blob or stream`,
  );
};

/**
 * A multipart body: the IR's binary parts as files with their content type,
 * every other field as a JSON part (the spec's `encoding` for them).
 */
export const multipartBody = async (
  body: unknown,
  binaryParts: readonly BinaryPart[],
): Promise<FormData> => {
  const parts = await Promise.all(
    Object.entries(body ?? {})
      .filter(([, value]: [string, unknown]) => value !== undefined)
      .map(async ([name, value]: [string, unknown]) => {
        const part = binaryParts.find((candidate) => candidate.name === name);
        return part === undefined
          ? {
              name,
              blob: new Blob([JSON.stringify(value)], {
                type: "application/json",
              }),
            }
          : {
              name,
              blob: new Blob([...(await readUploadable(value, name))], {
                type: part.contentType,
              }),
              filename: name,
            };
      }),
  );
  const form = new FormData();
  parts.forEach(({ name, blob, filename }) => {
    if (filename === undefined) {
      form.append(name, blob);
    } else {
      form.append(name, blob, filename);
    }
  });
  return form;
};
