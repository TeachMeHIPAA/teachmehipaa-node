# Testing

## A Sandbox client

The Sandbox is a separate deployment where Learners never get email. It needs
its own API client; Live credentials fail there, and the reverse.

```ts sample=testing-sandbox
import TeachMeHipaa from "teachmehipaa";

const client = new TeachMeHipaa({
  clientId: process.env.TMH_SANDBOX_CLIENT_ID!,
  clientSecret: process.env.TMH_SANDBOX_CLIENT_SECRET!,
  environment: "sandbox",
});

const token = await client.auth.introspect();
console.log(token.mode);
```

`auth.introspect` returns `mode: "test"` for a Sandbox token. Assert on it in
a suite's setup to catch Live credentials early.

## A fake `transport`

Every request, the token request included, goes through `transport`: a
function from `TransportRequest` to `Promise<Response>`. Replace it and no
request leaves the process:

```ts sample=testing-fake-transport
import TeachMeHipaa, {
  type Transport,
  type TransportRequest,
} from "teachmehipaa";

const sent: TransportRequest[] = [];
const transport: Transport = async (request) => {
  sent.push(request);
  const { pathname } = new URL(request.url);
  if (pathname === "/v1/organizations/org_test/compliance") {
    return Response.json({
      asOf: "2026-11-15T12:00:00.000Z",
      courseId: "hipaa-2026",
      totals: {
        learners: 2,
        compliant: 1,
        expiringSoon: 0,
        expired: 0,
        inProgress: 1,
        notStarted: 0,
        inviteBounced: 0,
      },
      compliantRate: 0.5,
    });
  }
  return Response.json({ code: "not_found" }, { status: 404 });
};

const client = new TeachMeHipaa({
  tokenProvider: { getAccessToken: async () => "test-token", invalidate() {} },
  organizationId: "org_test",
  transport,
  maxRetries: 0,
});

const summary = await client.compliance.retrieve();
console.log(summary.compliantRate, sent.length);
```

- A token provider that returns a fixed string, as above, or
  `staticTokenProvider("test-token")`, keeps token requests out of the fake.
- `organizationId` skips the `auth.introspect` lookup.
- `maxRetries: 0` surfaces a scripted failure on the first attempt.
- A `clock` whose `sleep` resolves at once makes backoff and `wait()` polling
  instant. It has two methods: `now()` and `sleep(ms)`.
- Resolve error statuses as `Response`s. Reject only to simulate a dropped
  connection, which the client raises as `ConnectionError`.

To keep the real HTTP handling and change only how bytes leave, such as for
mTLS, pass `fetch` instead (see [The client](client.md#custom-fetch)).

## A mock server

Point `baseUrl` at a mock of the OpenAPI document, such as
[Prism](https://stoplight.io/open-source/prism). Mocks can't mint Access
tokens, so pass a static token and the Organization:

```ts sample=testing-mock-server
import TeachMeHipaa, { staticTokenProvider } from "teachmehipaa";

const client = new TeachMeHipaa({
  baseUrl: "http://127.0.0.1:4010/v1",
  tokenProvider: staticTokenProvider("mock-token"),
  organizationId: "org_acme",
});

const page = await client.learners.list({ limit: 5 });
console.log(page.items.length);
```

## Webhook handlers

`webhooks.generateTestHeaders` signs a payload as TeachMeHIPAA does. Send
your handler one Delivery it should accept and one it should reject. This
drives a handler shaped like the
[fetch handler](webhooks.md#fetch-handlers) in the webhooks guide:

```ts sample=testing-webhook-handler
import { WebhookSignatureError, webhooks } from "teachmehipaa";

const secret = "test-signing-secret";

const handle = async (request: Request): Promise<Response> => {
  try {
    const event = await webhooks.constructEvent(
      await request.text(),
      request.headers,
      secret,
      request.url,
    );
    return new Response("test" in event ? "test" : event.eventType);
  } catch (error) {
    if (error instanceof WebhookSignatureError) {
      return new Response(error.code, { status: 400 });
    }
    throw error;
  }
};

const payload = JSON.stringify({ subscriptionId: "whs_01JD8Q", test: true });
const headers = await webhooks.generateTestHeaders({
  payload,
  secret,
  path: "/webhooks/tmh",
});
const url = "https://hr.example.com/webhooks/tmh";

const accepted = await handle(
  new Request(url, { method: "POST", headers, body: payload }),
);
const forged = await handle(
  new Request(url, { method: "POST", headers, body: `${payload} ` }),
);
console.log(accepted.status, forged.status, await forged.text());
```

A different path, or a body one byte off, fails here as it would in
production. `timestamp` signs as of another time, to test that stale
Deliveries get rejected.
