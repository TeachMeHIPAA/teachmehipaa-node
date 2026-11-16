import { WebhookSignatureError } from "./errors.js";
import type { Event } from "../models/event.js";
import type { TestDelivery } from "../models/test-delivery.js";
import type { UnknownEvent } from "../models/unknown-event.js";
import { prefixed, usageError } from "./usage.js";

/** Request headers as Node, Express, Fetch and most frameworks expose them. */
export type WebhookHeaders =
  Headers | Readonly<Record<string, string | readonly string[] | undefined>>;

export interface ConstructEventOptions {
  /**
   * How far, in seconds, the Delivery's timestamp may be from `receivedAt` in
   * either direction. Defaults to 300.
   */
  readonly tolerance?: number;
  /** When the Delivery arrived. Defaults to now. */
  readonly receivedAt?: Date;
}

export interface GenerateTestHeadersParams {
  /** The exact body you will send, as a string or bytes. */
  readonly payload: string | Uint8Array;
  readonly secret: string;
  /** The request path, with its query string, the handler is mounted on. */
  readonly path: string;
  /** Defaults to now. */
  readonly timestamp?: Date;
  readonly eventType?: string;
  readonly eventId?: string;
  readonly keyId?: string;
}

const encoder = new TextEncoder();

const toBytes = (body: string | Uint8Array): Uint8Array<ArrayBuffer> =>
  typeof body === "string" ? encoder.encode(body) : new Uint8Array(body);

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

const sha256Hex = async (bytes: Uint8Array<ArrayBuffer>): Promise<string> =>
  toHex(await crypto.subtle.digest("SHA-256", bytes));

// ADR-0005: the key is the Signing secret's UTF-8 bytes. The secret looks
// like base64, but the platform never decodes it.
const hmacKey = (secret: string) => {
  if (!secret) {
    throw usageError(
      "secret must be the Webhook subscription's Signing secret; got an empty value",
    );
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
};

const DEFAULT_TOLERANCE_SECONDS = 300;

const ISO_8601_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

const HEX_SHA256 = /^[0-9a-f]{64}$/;

const fromHex = (hex: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16));

const RAW_BODY_HINT =
  "Are you passing the raw request body exactly as received? Parsed and " +
  "re-serialized JSON does not verify.";

const header = (headers: WebhookHeaders, name: string): string | undefined => {
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name,
  );
  const value = entry?.[1];
  return typeof value === "string" ? value : value?.[0];
};

// Mirrors the platform signer, which signs `pathname + search` of the
// endpoint URL and takes a "/"-prefixed path as given.
const pathAndQuery = (path: string): string => {
  if (path.startsWith("/")) return path;
  if (URL.canParse(path)) {
    const url = new URL(path);
    return `${url.pathname}${url.search}`;
  }
  throw usageError(
    `path must be the request path (such as "/webhooks/tmh?x=1") or the full request URL, got "${path}"`,
  );
};

// ADR-0005; the vendored IR's `events.signing.canonical` describes the same
// four parts, and a test pins the two together.
const canonicalString = (
  signedPath: string,
  timestamp: string,
  bodyHash: string,
): Uint8Array<ArrayBuffer> =>
  encoder.encode(`POST\n${signedPath}\n${timestamp}\n${bodyHash}`);

const requiredHeader = (headers: WebhookHeaders, name: string): string => {
  const value = header(headers, name);
  if (value === undefined || value === "") {
    throw new WebhookSignatureError(
      "missing_header",
      `No ${name} header found on the Delivery. Are you passing the request ` +
        "headers as TeachMeHIPAA sent them?",
    );
  }
  return value;
};

const constructEvent = async (
  rawBody: string | Uint8Array,
  headers: WebhookHeaders,
  secret: string,
  path: string,
  options: ConstructEventOptions = {},
): Promise<Event | UnknownEvent | TestDelivery> => {
  const signedPath = pathAndQuery(path);
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE_SECONDS;
  if (!(tolerance > 0)) {
    throw new RangeError(
      prefixed("tolerance must be a positive number of seconds"),
    );
  }
  const signature = requiredHeader(headers, "x-tmh-signature");
  const timestamp = requiredHeader(headers, "x-tmh-timestamp");
  const signedAt = ISO_8601_DATE_TIME.test(timestamp)
    ? Date.parse(timestamp)
    : Number.NaN;
  if (Number.isNaN(signedAt)) {
    throw new WebhookSignatureError(
      "invalid_timestamp",
      `The x-tmh-timestamp header "${timestamp}" is not an ISO 8601 date-time.`,
    );
  }

  const body = toBytes(rawBody);
  const bodyHash = await sha256Hex(body);

  const sentBodyHash = header(headers, "x-tmh-body-hash");
  if (sentBodyHash !== undefined && sentBodyHash !== bodyHash) {
    throw new WebhookSignatureError(
      "body_hash_mismatch",
      `The x-tmh-body-hash header does not match the body. ${RAW_BODY_HINT}`,
    );
  }

  // `verify` compares in constant time, so the expected signature is never
  // compared byte by byte in JavaScript.
  const matched =
    HEX_SHA256.test(signature) &&
    (await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      fromHex(signature),
      canonicalString(signedPath, timestamp, bodyHash),
    ));
  if (!matched) {
    throw new WebhookSignatureError(
      "signature_mismatch",
      "No signature matched the expected signature for this Delivery. " +
        `${RAW_BODY_HINT} Are you passing the exact request path, with its ` +
        "query string, that the Delivery was sent to, and the Webhook " +
        "subscription's Signing secret?",
    );
  }

  const receivedAt = (options.receivedAt ?? new Date()).getTime();
  if (Math.abs(receivedAt - signedAt) > tolerance * 1000) {
    throw new WebhookSignatureError(
      "timestamp_outside_tolerance",
      `The Delivery's timestamp ${timestamp} is more than ${String(tolerance)} ` +
        "seconds from now. Check your server's clock; otherwise the Delivery " +
        "is being replayed.",
    );
  }

  return JSON.parse(new TextDecoder().decode(body)) as
    Event | UnknownEvent | TestDelivery;
};

const generateTestHeaders = async (
  params: GenerateTestHeadersParams,
): Promise<Record<string, string>> => {
  const timestamp = (params.timestamp ?? new Date()).toISOString();
  const bodyHash = await sha256Hex(toBytes(params.payload));
  const signature = toHex(
    await crypto.subtle.sign(
      "HMAC",
      await hmacKey(params.secret),
      canonicalString(pathAndQuery(params.path), timestamp, bodyHash),
    ),
  );
  return {
    ...(params.keyId === undefined ? {} : { "x-tmh-key-id": params.keyId }),
    "x-tmh-timestamp": timestamp,
    "x-tmh-signature": signature,
    "x-tmh-body-hash": bodyHash,
    ...(params.eventType === undefined
      ? {}
      : { "x-tmh-event-type": params.eventType }),
    ...(params.eventId === undefined
      ? {}
      : { "x-tmh-event-id": params.eventId }),
    "content-type": "application/json",
  };
};

/**
 * Verifies Deliveries and signs payloads for your own tests. Needs only the
 * Signing secret, never API credentials.
 */
export const webhooks = Object.freeze({
  /**
   * Verifies a Delivery and returns its Event, or the Test delivery.
   *
   * Pass the raw body exactly as received, and the path with its query
   * string (or the full URL) the request arrived on: the signature covers
   * both. A
   * Test delivery has a `test` property; anything else is an Event, and an
   * Event type this version doesn't know comes back as an `UnknownEvent`.
   *
   * @throws {WebhookSignatureError} when the Delivery fails verification.
   */
  constructEvent,
  /**
   * Returns the headers TeachMeHIPAA would send with `payload`, so you can
   * test your handler without a real Delivery.
   */
  generateTestHeaders,
});

export type Webhooks = typeof webhooks;
