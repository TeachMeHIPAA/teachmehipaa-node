/** One invalid field from a `validation_failed` problem. */
export interface FieldError {
  /** Dot-joined path, or `Idempotency-Key` for a missing header. */
  readonly path: string;
  readonly message: string;
}

export interface TeachMeHipaaErrorDetails {
  readonly message: string;
  readonly status: number | null;
  readonly code: string | null;
  readonly title: string | null;
  readonly detail: string | null;
  readonly errors: readonly FieldError[];
  readonly requestId: string | null;
  readonly headers: Readonly<Record<string, string>>;
  readonly raw: unknown;
}

/** The base of every error the library raises about an API call. */
export class TeachMeHipaaError extends Error {
  override readonly name: string = "TeachMeHipaaError";
  /** The HTTP status, or `null` when no response arrived. */
  readonly status: number | null;
  /**
   * The machine-readable reason, such as `seat_unavailable`. Branch on this;
   * new codes may appear at any time.
   */
  readonly code: string | null;
  readonly title: string | null;
  readonly detail: string | null;
  readonly errors: readonly FieldError[];
  /** Quote this to TeachMeHIPAA support. */
  readonly requestId: string | null;
  readonly headers: Readonly<Record<string, string>>;
  /** The response body: parsed JSON when it was JSON, otherwise the text. */
  readonly raw: unknown;

  constructor(details: TeachMeHipaaErrorDetails) {
    super(details.message);
    this.status = details.status;
    this.code = details.code;
    this.title = details.title;
    this.detail = details.detail;
    this.errors = details.errors;
    this.requestId = details.requestId;
    this.headers = details.headers;
    this.raw = details.raw;
  }
}
