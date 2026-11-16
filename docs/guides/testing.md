# Testing

## Use the Sandbox

The **Sandbox** Environment is a separate TeachMeHIPAA deployment for
development and tests. Learners there are never emailed, so you can create,
invite and offboard freely. Create a separate API client for it in the
console; Live credentials never work in the Sandbox, or the other way round.

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

`auth.introspect` reports `mode: "test"` for a Sandbox token, which makes a
cheap check that a test suite isn't pointed at Live.

## Fake the transport in unit tests

The client sends every request through a **transport**: a function that takes
the request the library built and resolves a `Response`. Pass your own as
`transport` to test your code without the network. It sees every request,
the token request included, so it can assert on what your code sent:

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

Tips for tests:

- A **token provider** that returns a fixed token, as above, keeps token
  requests out of your fakes. `staticTokenProvider("test-token")` does the
  same.
- Pass **`organizationId`** so the client doesn't introspect the token to find
  the Organization.
- Set **`maxRetries: 0`** to see a scripted failure at once, instead of after
  the client's retries and backoff.
- A **`clock`** option replaces real time: `now()` and `sleep(ms)`. A fake
  clock that returns from `sleep` at once makes retry backoff and
  `Operation.wait()` polling instant.
- The transport resolves error statuses as responses; reject only to simulate
  a network failure, which the client raises as `ConnectionError`.

The transport also suits a proxy or mTLS. To keep the built-in HTTP handling
and only change how requests leave, pass a `fetch` instead (see
[Configuration](configuration.md)).

## Run against a mock server

To check your requests against the Developer API's OpenAPI document, point
the client at a mock server, such as [Prism](https://stoplight.io/open-source/prism),
with `baseUrl`. Mock servers usually can't issue Access tokens, so give the
client a static token and its Organization:

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

## Test your webhook handler

`webhooks.generateTestHeaders` signs a payload the way TeachMeHIPAA does. Use
it to send your handler a Delivery it should accept, and tampered ones it
should refuse. This test drives a fetch-style handler like the one in
[Webhooks](webhooks.md#fetch-style-handlers):

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

Sign exactly the body and path you send: a different path, or a body that
differs by one byte, fails verification just as it would in production. Pass
`timestamp` to sign as of another time, such as to test that your handler
rejects stale Deliveries.
