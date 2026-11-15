import type { Transport, TransportRequest } from "../../src/index.js";

export interface ScriptedReply {
  readonly status?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly json?: unknown;
  readonly body?: string;
}

export type ScriptStep =
  | ScriptedReply
  | ((request: TransportRequest) => ScriptedReply | Promise<ScriptedReply>);

export interface FakeTransport {
  readonly transport: Transport;
  /** Every request the client sent, in order. */
  readonly requests: readonly TransportRequest[];
  /**
   * Queue replies for a route such as `"GET /v1/auth/introspection"`. Each
   * matching request consumes the next step; an unscripted request fails the
   * test.
   */
  script(route: string, ...steps: readonly ScriptStep[]): FakeTransport;
  requestsTo(route: string): readonly TransportRequest[];
}

const routeOf = (request: TransportRequest): string =>
  `${request.method} ${new URL(request.url).pathname}`;

const toResponse = (reply: ScriptedReply): Response => {
  const headers = new Headers(reply.headers);
  if (reply.json !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const body =
    reply.json !== undefined
      ? JSON.stringify(reply.json)
      : (reply.body ?? null);
  return new Response(body, { status: reply.status ?? 200, headers });
};

export const createFakeTransport = (): FakeTransport => {
  const requests: TransportRequest[] = [];
  const scripts = new Map<string, ScriptStep[]>();

  const transport: Transport = async (request) => {
    requests.push(request);
    const route = routeOf(request);
    const step = scripts.get(route)?.shift();
    if (step === undefined) {
      throw new Error(`Fake transport: unscripted request ${route}`);
    }
    const reply = typeof step === "function" ? await step(request) : step;
    return toResponse(reply);
  };

  const fake: FakeTransport = {
    transport,
    requests,
    script(route, ...steps) {
      scripts.set(route, [...(scripts.get(route) ?? []), ...steps]);
      return fake;
    },
    requestsTo: (route) => requests.filter((r) => routeOf(r) === route),
  };
  return fake;
};
