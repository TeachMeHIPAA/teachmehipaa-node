# Pagination and the Event log

Samples use a `client` created as in [Getting started](getting-started.md).

## Lists

Every list method, such as `learners.list` or `certificates.list`, returns a
page you can await, or iterate with `for await` to get every item across all
pages. Pages are fetched only as you consume them.

```ts sample=pagination
// Every Learner, page by page, fetched lazily.
for await (const learner of client.learners.list({ limit: 100 })) {
  console.log(learner.learnerId);
}

// At most 500 Learners in one array. The limit is required, so a large list
// can't fill memory by accident.
const learners = await client.learners
  .list({ status: "expired" })
  .autoPagingToArray({ limit: 500 });

// One page at a time.
const page = await client.enrollments.list({ limit: 50 });
if (page.hasNextPage()) {
  const next = await page.getNextPage();
  console.log(next.items.length, learners.length);
}
```

What you can do with a list:

| Call                                  | Result                                                |
| ------------------------------------- | ----------------------------------------------------- |
| `await list(params)`                  | The first page: `items`, `nextCursor`, `lastResponse` |
| `for await (const item of list())`    | Every item on every page, in order                    |
| `list().autoPagingToArray({ limit })` | Up to `limit` items (at most 10,000) in one array     |
| `page.hasNextPage()`                  | Whether more items follow                             |
| `page.getNextPage()`                  | The next page, with the same filters and `limit`      |
| `page.iterPages()`                    | This page and each one after it, as an async iterator |

`limit` sets the page size; each list's maximum is in the
[resource reference](../reference/resources.md). Breaking out of a
`for await` loop stops fetching.

To work a page at a time, such as to write each page in one database
transaction, iterate the pages:

```ts sample=pagination-pages
const first = await client.certificates.list({ limit: 100 });
for await (const page of first.iterPages()) {
  console.log(page.items.length, page.lastResponse.requestId);
}
```

## The Event log

Each Organization keeps an Event log: a record of what happened, such as
`learner.certified` or `invite.bounced`, kept for 30 days. Webhooks push these
Events to you as they happen (see [Webhooks](webhooks.md)); the Event log lets
you pull them, and catch up on anything you missed.

`events.list` reads the log oldest first. Filter by Event type with `type`,
and start after an Event you already have with `after`. Switch on `eventType`
to get the typed `data` of each Event type:

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

New Event types are added over time and none are removed, so always handle
types you don't recognize.

Reading the log needs the `webhooks:manage` or `audit:read` Scope.

## Tailing the Event log

`events.tail` reads the log oldest first and keeps its own position in
`lastEventId`. Save it, and resume from it after a restart to catch up on
anything you missed while down, without webhooks. Here `cursors` stands in for
your own storage:

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
| `after`    | The oldest Event | Start after this Event id, such as a saved `lastEventId`      |
| `follow`   | `false`          | Once caught up, keep polling for new Events instead of ending |
| `interval` | `2000`           | Milliseconds between polls once caught up, in follow mode     |
| `signal`   | None             | An `AbortSignal` that ends the loop at the next Event or poll |
| `type`     | Every type       | Only Events of this type                                      |
| `limit`    | The API's (20)   | Events per request                                            |

Without `follow`, the loop ends once it has caught up. With it, the tail
polls every `interval` milliseconds until you `break` or abort the signal;
aborting ends the loop normally rather than throwing.

The log keeps 30 days of Events. A consumer that is down longer than that
should resynchronize from the lists, such as `learners.list`, before tailing
again.
