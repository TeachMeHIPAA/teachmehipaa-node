/** File content for a multipart part, such as an Enrollment import's CSV. */
export type Uploadable = Blob | ArrayBuffer | Uint8Array;

export interface BinaryPart {
  readonly name: string;
  readonly contentType: string;
}

const isUploadable = (value: unknown): value is Uploadable =>
  value instanceof Blob ||
  value instanceof ArrayBuffer ||
  value instanceof Uint8Array;

/**
 * A multipart body: the IR's binary parts as files with their content type,
 * every other field as a JSON part (the spec's `encoding` for them).
 */
export const multipartBody = (
  body: unknown,
  binaryParts: readonly BinaryPart[],
): FormData => {
  const form = new FormData();
  Object.entries(body ?? {}).forEach(([name, value]: [string, unknown]) => {
    if (value === undefined) {
      return;
    }
    const part = binaryParts.find((candidate) => candidate.name === name);
    if (part === undefined) {
      form.append(
        name,
        new Blob([JSON.stringify(value)], { type: "application/json" }),
      );
      return;
    }
    if (!isUploadable(value)) {
      throw new TypeError(
        `TeachMeHipaa: ${name} must be a Blob, ArrayBuffer or Uint8Array`,
      );
    }
    form.append(name, new Blob([value], { type: part.contentType }), name);
  });
  return form;
};
