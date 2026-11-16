# Webhooks

A **Webhook subscription** tells TeachMeHIPAA to POST Events of the types you
choose, such as `learner.certified`, to your HTTPS endpoint. Each POST is a
**Delivery**, signed with the subscription's **Signing secret** so you can
prove it came from TeachMeHIPAA. Failed Deliveries are retried until they
succeed or are dead-lettered.

Samples use a `client` created as in [Getting started](getting-started.md).

## Create a Webhook subscription

```ts sample=webhook-subscription-create
const subscription = await client.webhookSubscriptions.create({
  endpointUrl: "https://hr.example.com/webhooks/tmh",
  eventTypes: ["learner.certified", "learner.expiring", "invite.bounced"],
  description: "HR sync",
});
console.log(subscription.subscriptionId, subscription.secretKeyId);
await secrets.put("tmh-webhook-secret", subscription.secret);
```

The response holds the Signing secret in `secret` **only once**: store it
right away, in the place your handler reads it from (here `secrets` stands in
for your secret store). Managing subscriptions needs the `webhooks:manage`
Scope.

`webhookSubscriptions.list`, `retrieve`, `update` and `delete` manage
subscriptions; `update` needs the subscription's ETag (see
[Conditional requests](conditional-requests.md)), and setting `enabled: false`
pauses Deliveries.

## Verify every Delivery

`webhooks.constructEvent` verifies a Delivery and returns its Event, or the
Test delivery. It needs four things, three of them exactly as they arrived:

1. **The raw body.** Parsed and re-serialized JSON never verifies, so read the
   body as bytes or text before any JSON middleware touches it.
2. **The headers.** Pass them as your framework gives them: a `Headers`
   object or a plain object both work.
3. **The Signing secret** of the subscription.
4. **The request path, with its query string.** The signature covers the path
   the Delivery was sent to, so a verifier that ignores it rejects every
   Delivery. The full request URL works too.

Deliveries signed more than 5 minutes from your clock, in either direction,
are rejected, so keep your server's clock in sync. A failed check rejects with
`WebhookSignatureError`, whose `code` says why:

| `code`                        | Meaning                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| `missing_header`              | A signature header is missing                                |
| `invalid_timestamp`           | `x-tmh-timestamp` isn't an ISO 8601 date-time                |
| `body_hash_mismatch`          | The body isn't the one that was signed (it was parsed?)      |
| `signature_mismatch`          | Wrong secret, wrong path, or a forged Delivery               |
| `timestamp_outside_tolerance` | Signed more than 5 minutes from now: a replay, or clock skew |

Answer a `WebhookSignatureError` with 400 and do nothing else. The error never
carries the body or headers, which hold Learner details, so it is safe to log.

`webhooks` needs only the Signing secret, never API credentials, so a handler
can import it on its own. It is also available as `client.webhooks` and
`TeachMeHipaa.webhooks`.

### Express

Mount `express.raw` on the webhook route so the body stays a `Buffer`, and
pass `req.originalUrl`, which keeps the mount path and query string:

```ts sample=webhook-express
import express from "express";
import { WebhookSignatureError, webhooks } from "teachmehipaa";

const app = express();

app.post(
  "/webhooks/tmh",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const event = await webhooks.constructEvent(
        req.body as Buffer,
        req.headers,
        process.env.TMH_WEBHOOK_SECRET!,
        req.originalUrl,
      );
      if ("test" in event) {
        res.sendStatus(200);
        return;
      }
      if (event.eventType === "learner.certified") {
        console.log("Certified:", event.data);
      }
      res.sendStatus(200);
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        res.status(400).send(error.code);
        return;
      }
      throw error;
    }
  },
);

app.listen(3000);
```

If `express.json()` runs app-wide, register the webhook route before it, or
it will have parsed the body by the time your handler runs.

### Fetch-style handlers

With a handler that takes a web `Request` (Next.js route handlers, Hono, Bun,
Deno, Cloudflare Workers), read the body with `request.text()` and pass the
full request URL as the path:

```ts sample=webhook-fetch
import { WebhookSignatureError, webhooks } from "teachmehipaa";

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      const event = await webhooks.constructEvent(
        await request.text(),
        request.headers,
        process.env.TMH_WEBHOOK_SECRET!,
        request.url,
      );
      if ("test" in event) {
        return new Response("test received");
      }
      return new Response(`received ${event.eventType}`);
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        return new Response(error.code, { status: 400 });
      }
      throw error;
    }
  },
};
```

### Node's `http` module

Collect the body chunks, then verify:

```ts sample=webhook-node-http
import { createServer } from "node:http";
import { WebhookSignatureError, webhooks } from "teachmehipaa";

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  try {
    const event = await webhooks.constructEvent(
      Buffer.concat(chunks),
      req.headers,
      process.env.TMH_WEBHOOK_SECRET!,
      req.url ?? "/",
    );
    console.log("test" in event ? "test delivery" : event.eventType);
    res.writeHead(200).end();
  } catch (error) {
    if (error instanceof WebhookSignatureError) {
      res.writeHead(400).end(error.code);
      return;
    }
    res.writeHead(500).end();
  }
}).listen(3000);
```

## Handle Events

- **Answer fast.** Return a 2xx as soon as the Delivery verifies, and do slow
  work afterwards, such as from a queue. A Delivery that times out or fails is
  delivered again.
- **Expect duplicates.** A retried Delivery carries the same Event, with the
  same `eventId`. Record the ids you've handled and skip repeats.
- **Expect new Event types.** Event types are added over time. One this
  version doesn't know arrives as an `UnknownEvent`, with its `eventType` and
  `data` as sent, so your handler keeps working; ignore types you don't use.
- **Don't rely on order.** A retried Delivery can arrive after a later one.
  Compare `occurredAt`, or read the current state with the API.

Here `processedEvents` stands in for your own store of handled ids:

```ts sample=webhook-dedupe
import { webhooks } from "teachmehipaa";

export const handleDelivery = async (
  body: string,
  headers: Headers,
  url: string,
): Promise<void> => {
  const event = await webhooks.constructEvent(
    body,
    headers,
    process.env.TMH_WEBHOOK_SECRET!,
    url,
  );
  if ("test" in event || (await processedEvents.has(event.eventId))) {
    return;
  }
  console.log("handling", event.eventType, event.eventId);
  await processedEvents.add(event.eventId);
};
```

If your endpoint was down, `webhookSubscriptions.redrive` delivers the
subscription's failed Events again, and the [Event log](pagination-and-events.md#the-event-log)
has every Event of the last 30 days.

## Test deliveries

`webhookSubscriptions.test` sends a signed **Test delivery** to the
subscription's endpoint, so you can check your verifier end to end. It
returns an Operation; wait on it to see how the Delivery went:

```ts sample=webhook-test-delivery
const operation = await client.webhookSubscriptions.test("whs_01JD8Q");
const done = await operation.wait();
const result = done.response;
if (result?._tag === "sent" && "responseStatus" in result) {
  console.log("Endpoint answered", result.responseStatus);
} else if (result?._tag === "failed" && "reason" in result) {
  console.log("Delivery failed:", result.reason);
} else {
  console.log("Delivery result:", result?._tag);
}
```

The result's `_tag` is `sent`, `failed` or `settled` (the Delivery had
already ended), and new tags may appear, so keep the fallback branch.

A Test delivery carries no Event: its body is `{ subscriptionId, test: true }`,
which `constructEvent` returns as is. Check for it with `"test" in event`
before you treat the result as an Event.

## Sign Deliveries in your own tests

`webhooks.generateTestHeaders` returns the headers TeachMeHIPAA would send with
a payload, so you can test your handler without a real Delivery. Sign the
exact body and path you'll send:

```ts sample=webhook-test-headers
import { webhooks } from "teachmehipaa";

const payload = JSON.stringify({
  eventId: "evt_01JD8M",
  eventType: "learner.certified",
  orgId: "org_acme",
  occurredAt: "2026-11-15T12:00:00.000Z",
  data: { subjectId: "sub_01JD80AB2C3D4E5F6G7H8J9K0M", courseId: "hipaa-2026" },
});
const headers = await webhooks.generateTestHeaders({
  payload,
  secret: "test-signing-secret",
  path: "/webhooks/tmh",
});

const event = await webhooks.constructEvent(
  payload,
  headers,
  "test-signing-secret",
  "/webhooks/tmh",
);
console.log(event);
```

[Testing](testing.md#test-your-webhook-handler) shows this in a handler test.

## Signature details

You don't need these to use `constructEvent`, but they help when debugging.
Each Delivery carries:

| Header             | Holds                                       |
| ------------------ | ------------------------------------------- |
| `x-tmh-signature`  | Hex HMAC-SHA256 of the canonical string     |
| `x-tmh-timestamp`  | When it was signed, ISO 8601                |
| `x-tmh-body-hash`  | Hex SHA-256 of the body                     |
| `x-tmh-event-id`   | The Event's id (a UUID for a Test delivery) |
| `x-tmh-event-type` | The Event type                              |
| `x-tmh-key-id`     | Which Signing secret signed it              |

The canonical string is `POST`, the path with its query string, the
timestamp and the body hash, joined by newlines. The HMAC key is the Signing
secret's UTF-8 bytes, used as is (not base64-decoded).
