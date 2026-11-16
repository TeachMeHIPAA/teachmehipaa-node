import type { Operation as OperationModel } from "../models/operation.js";
import { pause } from "./clock.js";
import {
  OperationFailedError,
  OperationTimeoutError,
  noResponseDetails,
} from "./errors.js";
import { isRecord, problemFields } from "./problem.js";
import { jitteredBackoff } from "./retry.js";
import type { RequestSpec, Requester } from "./requester.js";
import type { ResponseMetadata } from "./response.js";
import { usageError } from "./usage.js";

/** Options for `Operation.wait`. */
export interface OperationWaitOptions {
  /** Milliseconds to wait in all before giving up. Defaults to 5 minutes. */
  readonly timeout?: number;
  /** Milliseconds before the first poll; later polls back off. Defaults to 1000. */
  readonly interval?: number;
  /** Stops waiting; the promise then rejects with the signal's reason. */
  readonly signal?: AbortSignal;
}

/**
 * How a Test delivery or a redrive ended: the `response` of the Operation
 * that `webhookSubscriptions.test` and `webhookSubscriptions.redrive` return.
 * Tell the variants apart by `_tag`. Others may appear, such as when there was
 * nothing to deliver or the delivery could not be queued; they arrive as an
 * `UnknownWebhookDeliveryResult`, so handle tags you don't recognize.
 */
export type WebhookDeliveryResult =
  /** The endpoint accepted the Delivery. */
  | { readonly _tag: "sent"; readonly responseStatus: number }
  /** Delivery stopped for good; `reason` says why. */
  | {
      readonly _tag: "failed";
      readonly reason: string;
      /** The endpoint's last status, when it answered at all. */
      readonly responseStatus?: number;
    }
  /** The Delivery had already ended before this Operation; `status` is how. */
  | { readonly _tag: "settled"; readonly status: string }
  | UnknownWebhookDeliveryResult;

/**
 * A delivery result whose `_tag` this version doesn't know yet. Results only
 * grow (ADR-0006), so it is read as it came, every field kept.
 */
export interface UnknownWebhookDeliveryResult {
  // `Record<never, never>` keeps the known tags in editor completions.
  readonly _tag: string & Record<never, never>;
  readonly [field: string]: unknown;
}

/**
 * The file an export Operation produced: `enrollments.export`,
 * `certificates.export` or `learners.export`.
 */
export interface ExportResult {
  /** The whole CSV file as text: RFC 4180, CRLF line endings. */
  readonly csv: string;
  /** A suggested file name, such as `enrollments-org_acme.csv`. */
  readonly filename: string | null;
  /** The number of data rows, not counting the header. */
  readonly rowCount: number | null;
}

/**
 * Work that may finish after the request that started it, such as an export
 * or a redrive. `response` holds the result once `done` is `true`, unless
 * `error` holds the problem.
 */
export interface Operation<TResponse = unknown> extends Omit<
  OperationModel,
  "response"
> {
  /** The result, once `done` is `true`. */
  readonly response?: TResponse;
  readonly lastResponse: ResponseMetadata;
  /**
   * Polls until the Operation is done and resolves with its final state. An
   * Operation that is already done resolves at once, without a request.
   */
  wait(options?: OperationWaitOptions): Promise<Operation<TResponse>>;
  /**
   * The CSV file of a done export Operation. Raises `OperationFailedError` if
   * the export failed, and a `TypeError` for an Operation that is not done or
   * is not an export.
   */
  exportResult(): ExportResult;
}

type Received = OperationModel & { readonly lastResponse: ResponseMetadata };

const DEFAULT_TIMEOUT_MS = 5 * 60_000;
const DEFAULT_INTERVAL_MS = 1_000;
const MAX_INTERVAL_MS = 10_000;

// Backs off from `interval` up to 10 s; an `interval` longer than the cap
// stays as it is.
const pollDelay = (interval: number, pollNumber: number): number =>
  jitteredBackoff(interval, Math.max(MAX_INTERVAL_MS, interval), pollNumber);

/**
 * The `operationId` in an Operation's `name`, which is
 * `organizations/{orgId}/operations/{operationId}`: what
 * `operations.retrieve` takes.
 */
export const operationIdFromName = (name: string): string => {
  const operationId = /^organizations\/[^/]+\/operations\/([^/]+)$/.exec(
    name,
  )?.[1];
  if (operationId === undefined) {
    throw usageError(
      `"${name}" is not an Operation name (organizations/{orgId}/operations/{operationId})`,
    );
  }
  return operationId;
};

const timedOut = (
  operation: Operation,
  timeout: number,
): OperationTimeoutError =>
  new OperationTimeoutError({
    ...noResponseDetails(
      `Operation ${operation.name} was not done after ${String(timeout)} ms`,
    ),
    requestId: operation.lastResponse.requestId,
    headers: operation.lastResponse.headers,
    operation,
  });

const failed = (operation: Operation): OperationFailedError => {
  const { error } = operation;
  const { summary, ...problem } = problemFields(error);
  return new OperationFailedError({
    message: summary === "" ? `Operation ${operation.name} failed` : summary,
    status: typeof error?.status === "number" ? error.status : null,
    ...problem,
    requestId: operation.lastResponse.requestId,
    headers: operation.lastResponse.headers,
    raw: error,
    operation,
  });
};

/** The finished Operation, or the error it finished with. */
const settled = <TResponse>(
  operation: Operation<TResponse>,
): Operation<TResponse> => {
  if (operation.error !== undefined) {
    throw failed(operation);
  }
  return operation;
};

// The spec says only that an export's `response` "holds the CSV file". The
// API sends it inline as `{format: "csv", contentType, filename, rowCount,
// dataBase64}` (the monorepo's `ExportArtifact`), the file base64-encoded.
const exportResultOf = (operation: Operation): ExportResult => {
  if (!operation.done) {
    throw usageError(
      `Operation ${operation.name} is not done; call wait() first`,
    );
  }
  const { response } = settled(operation);
  if (
    !isRecord(response) ||
    response.format !== "csv" ||
    typeof response.dataBase64 !== "string"
  ) {
    throw usageError(
      `Operation ${operation.name} did not produce a CSV export`,
    );
  }
  return {
    csv: Buffer.from(response.dataBase64, "base64").toString("utf8"),
    filename: typeof response.filename === "string" ? response.filename : null,
    rowCount: typeof response.rowCount === "number" ? response.rowCount : null,
  };
};

const withMethods = <TResponse>(
  requester: Requester,
  received: Received,
): Operation<TResponse> => {
  // The same call as the generated `operations.retrieve`.
  const retrieve = (operationId: string) =>
    requestOperation<TResponse>(requester, {
      method: "GET",
      path: "/operations/{operationId}",
      pathParams: { operationId },
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "none",
    });

  const wait = async ({
    timeout = DEFAULT_TIMEOUT_MS,
    interval = DEFAULT_INTERVAL_MS,
    signal,
  }: OperationWaitOptions = {}): Promise<Operation<TResponse>> => {
    const { clock } = requester;
    const deadline = clock.now() + timeout;
    // The last sleep is cut short so the final poll lands on the deadline.
    const poll = async (
      latest: Operation<TResponse>,
      pollNumber: number,
    ): Promise<Operation<TResponse>> => {
      if (latest.done) {
        return settled(latest);
      }
      signal?.throwIfAborted();
      const remaining = deadline - clock.now();
      if (remaining <= 0) {
        throw timedOut(latest, timeout);
      }
      const delay = Math.min(pollDelay(interval, pollNumber), remaining);
      await pause(clock, delay, signal);
      signal?.throwIfAborted();
      return poll(
        await retrieve(operationIdFromName(received.name)),
        pollNumber + 1,
      );
    };
    return poll(operation, 1);
  };

  const operation = Object.defineProperties(received as Operation<TResponse>, {
    wait: { value: wait, enumerable: false },
    exportResult: { value: () => exportResultOf(operation), enumerable: false },
  });
  return operation;
};

/** Sends a request whose success is an Operation, and adds its methods. */
export const requestOperation = async <TResponse = unknown>(
  requester: Requester,
  spec: RequestSpec,
): Promise<Operation<TResponse>> => {
  return withMethods<TResponse>(
    requester,
    await requester.request<OperationModel>(spec),
  );
};
