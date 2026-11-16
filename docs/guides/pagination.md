# Lists and the Event log

Samples use the `client` from [The client](client.md).

## `for await`

A list method returns a `PagePromise`. Await it for the first page, or
iterate it with `for await` for every item on every page. Pages load only as
the loop reaches them, and `break` stops the fetching.

```ts sample=pagination
for await (const learner of client.learners.list({ limit: 100 })) {
  console.log(learner.learnerId);
}

// The limit is required, so a huge list can't fill memory by accident.
const learners = await client.learners
  .list({ status: "expired" })
  .autoPagingToArray({ limit: 500 });

const page = await client.enrollments.list({ limit: 50 });
if (page.hasNextPage()) {
  const next = await page.getNextPage();
  console.log(next.items.length, learners.length);
}
```

| Expression                            | Gives you                                               |
| ------------------------------------- | ------------------------------------------------------- |
| `await list(params)`                  | The first `Page`: `items`, `nextCursor`, `lastResponse` |
| `for await (const item of list())`    | Every item, in order                                    |
| `list().autoPagingToArray({ limit })` | Up to `limit` items, at most 10,000                     |
| `page.hasNextPage()`                  | `true` while more items follow                          |
| `page.getNextPage()`                  | The next page, same filters and `limit`                 |
| `page.iterPages()`                    | An async iterator of this page and the ones after it    |

`limit` is the page size. The maximum differs per list; the
[resource reference](../reference/resources.md) has each one.

Iterate pages when a page is your unit of work, such as one database
transaction per page:

```ts sample=pagination-pages
const first = await client.certificates.list({ limit: 100 });
for await (const page of first.iterPages()) {
  console.log(page.items.length, page.lastResponse.requestId);
}
```

## The Event log

The Organization's Event log keeps 30 days of Events such as
`learner.certified` and `invite.bounced`. Webhooks push them; the log lets you
pull them and catch up. Reading it needs `webhooks:manage` or `audit:read`.

`events.list` returns the oldest first. `type` filters, `after` resumes past
an Event id. `eventType` narrows `data` in a `switch`:

```ts sample=events-list
for await (const event of client.events.list({ after: "evt_01" })) {
  switch (event.eventType) {
    case "learner.certified":
      console.log("certified", event.data.email);
      break;
    case "seats.low":
      console.log("Seats left:", event.data.available);
      break;
    default:
      console.log("other", event.eventType);
  }
}
```

The API adds Event types over time, so the `default` branch matters.

## Tailing the Event log

`events.tail` is an async iterator over the log that remembers where it is in
`lastEventId`. Persist that and pass it back as `after` on restart. `cursors`
stands for your storage:

```ts sample=events-tail
const controller = new AbortController();
const tail = client.events.tail({
  after: await cursors.load(),
  follow: true,
  interval: 5_000,
  signal: controller.signal,
});

for await (const event of tail) {
  console.log(event.eventType, event.eventId);
  await cursors.save(tail.lastEventId);
}
```

| Parameter  | Default          | Effect                                                        |
| ---------- | ---------------- | ------------------------------------------------------------- |
| `after`    | The oldest Event | Start after this Event id                                     |
| `follow`   | `false`          | Keep polling once caught up instead of ending                 |
| `interval` | `2000`           | Milliseconds between polls in follow mode                     |
| `signal`   | None             | An `AbortSignal` that ends the loop at the next Event or poll |
| `type`     | All types        | Only this Event type                                          |
| `limit`    | The API's, 20    | Events per request                                            |

Without `follow` the loop ends when it catches up. With it, the loop runs
until you `break` or abort. `controller.abort()` ends it at the next Event
or poll, without throwing. A consumer down for more than 30 days has lost Events
and should resync from the lists, such as `learners.list`, before tailing
again.
