# Webhooks

A Webhook subscription makes TeachMeHIPAA POST chosen Event types to your
HTTPS endpoint. Each POST is a Delivery, signed with the subscription's
Signing secret. Failed Deliveries are retried until they succeed or are
dead-lettered.

Samples that call the API use the `client` from [The client](client.md).

## Subscribe

```ts sample=webhook-subscription-create
const subscription = await client.webhookSubscriptions.create({
  endpointUrl: "https://hr.example.com/webhooks/tmh",
  eventTypes: ["learner.certified", "learner.expiring", "invite.bounced"],
  description: "HR sync",
});
console.log(subscription.subscriptionId, subscription.secretKeyId);
await secrets.put("tmh-webhook-secret", subscription.secret);
```

`secret` appears in this response and nowhere else. Store it where your
handler will read it (`secrets` stands for your secret store). Managing
subscriptions needs `webhooks:manage`. `list`, `retrieve`, `update` and
`delete` do the rest; `update` needs the ETag (see
[Writes](writes.md#conditional-writes)), and `enabled: false` pauses
Deliveries.

## Verify

`webhooks.constructEvent(rawBody, headers, secret, path, options?)` resolves
the typed Event, or the Test delivery. It needs:

1. `rawBody`: the bytes or text as received. Re-serialized JSON never
   verifies, so read the body before any JSON middleware parses it.
2. `headers`: a `Headers` object or a plain object, as your framework hands
   them over.
3. `secret`: the subscription's Signing secret.
4. `path`: the request path with its query string, or the full URL. The
   signature covers it, so a wrong path fails every Delivery.

`options.tolerance` (default 300 s) bounds clock skew in both directions.
Failures reject with `WebhookSignatureError`; answer 400 and stop. The error
holds no body or headers, so logging it leaks no Learner data.

| `code`                        | Cause                                                    |
| ----------------------------- | -------------------------------------------------------- |
| `missing_header`              | A signature header is absent                             |
| `invalid_timestamp`           | `x-tmh-timestamp` isn't ISO 8601                         |
| `body_hash_mismatch`          | The body changed after signing, usually by a JSON parser |
| `signature_mismatch`          | Wrong secret, wrong path, or a forgery                   |
| `timestamp_outside_tolerance` | Outside `tolerance`: a replay, or a skewed clock         |

`webhooks` uses only the Signing secret and Web Crypto, so a handler can
import it without creating a client. `client.webhooks` and
`TeachMeHipaa.webhooks` point at the same object.

### Express

`express.raw` keeps the body a `Buffer`; `req.originalUrl` keeps the mount
path and query string:

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

Register the route before an app-wide `express.json()`, or the body arrives
parsed.

### Fetch handlers

Next.js route handlers, Hono, Bun, Deno and Workers all hand you a `Request`.
Pass `request.text()` and `request.url`:

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

### `node:http`

`IncomingMessage` is an async iterable of chunks:

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

## Handling Events

Return 2xx as soon as the Delivery verifies and queue slow work; a timeout
counts as a failure and triggers a retry. Retries repeat the `eventId`, so
deduplicate on it. Deliveries can arrive out of order: compare `occurredAt`,
or read current state from the API. An Event type newer than your library
version arrives as `UnknownEvent` with its `eventType` and raw `data`.

`processedEvents` stands for your record of handled ids:

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

After an outage, `webhookSubscriptions.redrive` resends the subscription's
failed Events, and the [Event log](pagination.md#the-event-log) holds the last
30 days.

## Test deliveries

`webhookSubscriptions.test` sends a signed Test delivery to the endpoint and
returns an Operation. Its `response` says how the Delivery went:

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

`_tag` is `sent`, `failed` or `settled` (the Delivery had already ended),
with room for new tags. A Test delivery's body is
`{ subscriptionId, test: true }` and carries no Event; `"test" in event`
tells them apart.

## Signing your own payloads

`webhooks.generateTestHeaders` produces the headers TeachMeHIPAA would send
for a payload and path. Sign exactly the body and path you will send:

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

[Testing](testing.md#webhook-handlers) puts this in a handler test.

## Wire format

| Header             | Value                                     |
| ------------------ | ----------------------------------------- |
| `x-tmh-signature`  | Hex HMAC-SHA256 of the canonical string   |
| `x-tmh-timestamp`  | Signing time, ISO 8601                    |
| `x-tmh-body-hash`  | Hex SHA-256 of the body                   |
| `x-tmh-event-id`   | The Event id (a UUID for a Test delivery) |
| `x-tmh-event-type` | The Event type                            |
| `x-tmh-key-id`     | The Signing secret that signed it         |

The canonical string joins `POST`, the path with its query string, the
timestamp and the body hash with `\n`. The HMAC key is the secret's UTF-8
bytes, not base64-decoded.
