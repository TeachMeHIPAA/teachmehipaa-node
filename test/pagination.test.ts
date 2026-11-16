import { describe, expect, it } from "vitest";
import { type Clock } from "../src/index.js";
import { clientOn } from "./support/client.js";
import { createFakeClock } from "./support/fake-clock.js";
import {
  createFakeTransport,
  type FakeTransport,
  type ScriptedReply,
} from "./support/fake-transport.js";
import {
  ORG_ID,
  TOKEN_ROUTE,
  learnerBody,
  tokenReply,
} from "./support/fixtures.js";

const LEARNERS_ROUTE = `GET /v1/organizations/${ORG_ID}/learners`;
const EVENTS_ROUTE = `GET /v1/organizations/${ORG_ID}/events`;

const learner = (learnerId: string) => ({ ...learnerBody, learnerId });

/** `dev#/components/schemas/Event`, a `learner.certified` envelope. */
const event = (eventId: string) => ({
  eventId,
  eventType: "learner.certified",
  orgId: ORG_ID,
  occurredAt: "2026-11-15T16:31:30.000Z",
  data: {
    learnerId: learnerBody.learnerId,
    email: learnerBody.email,
    externalId: learnerBody.externalId,
    courseId: "hipaa-2026",
    status: "certified",
    occurredAt: "2026-11-15T16:31:30.000Z",
  },
});

/** The Developer API's page envelope: `{ items, nextCursor }`. */
const pageReply = (
  items: readonly unknown[],
  nextCursor: string | null,
): ScriptedReply => ({ json: { items, nextCursor } });

const queryOf = (url: string): Record<string, string> =>
  Object.fromEntries(new URL(url).searchParams);

describe("Auto-paging lists", () => {
  it("iterates every Learner across pages, following nextCursor through a short page until it is null", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        LEARNERS_ROUTE,
        pageReply([learner("sub_1"), learner("sub_2")], "cur_2"),
        // Filters apply per page, so a page can be short with more to come.
        pageReply([], "cur_3"),
        pageReply([learner("sub_3")], null),
      );

    const learnerIds: string[] = [];
    for await (const item of clientOn(fake).learners.list({ limit: 2 })) {
      learnerIds.push(item.learnerId);
    }

    expect(learnerIds).toEqual(["sub_1", "sub_2", "sub_3"]);
    expect(
      fake.requestsTo(LEARNERS_ROUTE).map((request) => queryOf(request.url)),
    ).toEqual([
      { limit: "2" },
      { limit: "2", cursor: "cur_2" },
      { limit: "2", cursor: "cur_3" },
    ]);
  });

  it("stops fetching pages when the loop breaks", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        LEARNERS_ROUTE,
        pageReply([learner("sub_1"), learner("sub_2")], "cur_2"),
        pageReply([learner("sub_3"), learner("sub_4")], "cur_3"),
        pageReply([learner("sub_5")], null),
      );

    const learnerIds: string[] = [];
    for await (const item of clientOn(fake).learners.list()) {
      learnerIds.push(item.learnerId);
      if (item.learnerId === "sub_3") {
        break;
      }
    }

    expect(learnerIds).toEqual(["sub_1", "sub_2", "sub_3"]);
    expect(fake.requestsTo(LEARNERS_ROUTE)).toHaveLength(2);
  });

  it("sends the first call's filters and limit with every page, unvalidated", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        LEARNERS_ROUTE,
        pageReply([learner("sub_1")], "cur_2"),
        pageReply([learner("sub_2")], null),
      );

    const learnerIds: string[] = [];
    // 500 is over the API's maximum of 100: the server, not the client,
    // rejects it.
    for await (const item of clientOn(fake).learners.list({
      limit: 500,
      status: "in_progress",
      courseId: "hipaa-2026",
    })) {
      learnerIds.push(item.learnerId);
    }

    expect(learnerIds).toEqual(["sub_1", "sub_2"]);
    expect(
      fake.requestsTo(LEARNERS_ROUTE).map((request) => queryOf(request.url)),
    ).toEqual([
      { limit: "500", status: "in_progress", courseId: "hipaa-2026" },
      {
        limit: "500",
        status: "in_progress",
        courseId: "hipaa-2026",
        cursor: "cur_2",
      },
    ]);
  });

  it("pages the Event log by `after`, the last Event's id, not `cursor`", async () => {
    // `nextCursor` is the last Event id while more rows exist.
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        EVENTS_ROUTE,
        pageReply([event("evt_01"), event("evt_02")], "evt_02"),
        pageReply([event("evt_03")], null),
      );

    const eventIds: string[] = [];
    for await (const item of clientOn(fake).events.list({
      type: "learner.certified",
    })) {
      eventIds.push(item.eventId);
    }

    expect(eventIds).toEqual(["evt_01", "evt_02", "evt_03"]);
    expect(
      fake.requestsTo(EVENTS_ROUTE).map((request) => queryOf(request.url)),
    ).toEqual([
      { type: "learner.certified" },
      { type: "learner.certified", after: "evt_02" },
    ]);
  });

  it("awaits to the first page, which fetches the pages after it on request", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        LEARNERS_ROUTE,
        {
          json: { items: [learner("sub_1")], nextCursor: "cur_2" },
          headers: { "x-request-id": "req_page_1" },
        },
        pageReply([learner("sub_2")], "cur_3"),
        pageReply([learner("sub_3")], null),
      );

    const first = await clientOn(fake).learners.list({ limit: 1 });

    expect(first).toEqual({ items: [learner("sub_1")], nextCursor: "cur_2" });
    expect(first.lastResponse.requestId).toBe("req_page_1");
    expect(first.hasNextPage()).toBe(true);
    expect(fake.requestsTo(LEARNERS_ROUTE)).toHaveLength(1);

    const second = await first.getNextPage();
    expect(second.items).toEqual([learner("sub_2")]);

    const pages = [];
    for await (const page of second.iterPages()) {
      pages.push(page.items.map((item) => item.learnerId));
    }
    expect(pages).toEqual([["sub_2"], ["sub_3"]]);
    expect(fake.requestsTo(LEARNERS_ROUTE)).toHaveLength(3);
  });

  it("rejects getNextPage on the last page without sending a request", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNERS_ROUTE, pageReply([learner("sub_1")], null));

    const page = await clientOn(fake).learners.list();

    expect(page.hasNextPage()).toBe(false);
    await expect(page.getNextPage()).rejects.toThrow(/last page/);
    expect(fake.requestsTo(LEARNERS_ROUTE)).toHaveLength(1);
  });

  it("collects items into an array up to the limit, fetching no further", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        LEARNERS_ROUTE,
        pageReply([learner("sub_1"), learner("sub_2")], "cur_2"),
        pageReply([learner("sub_3"), learner("sub_4")], "cur_3"),
        pageReply([learner("sub_5")], null),
      );

    const learners = await clientOn(fake)
      .learners.list()
      .autoPagingToArray({ limit: 3 });

    expect(learners.map((item) => item.learnerId)).toEqual([
      "sub_1",
      "sub_2",
      "sub_3",
    ]);
    expect(fake.requestsTo(LEARNERS_ROUTE)).toHaveLength(2);
  });

  it.each([undefined, 0, 1.5, 10_001])(
    "requires autoPagingToArray's limit to be a whole number from 1 to 10,000 (%s)",
    async (limit) => {
      const fake = createFakeTransport()
        .script(TOKEN_ROUTE, tokenReply())
        .script(LEARNERS_ROUTE, pageReply([learner("sub_1")], null));
      const list = clientOn(fake).learners.list();

      await expect(
        list.autoPagingToArray({ limit } as { limit: number }),
      ).rejects.toThrow(TypeError);
    },
  );
});

describe("Tailing the Event log", () => {
  const afterParams = (fake: FakeTransport) =>
    fake
      .requestsTo(EVENTS_ROUTE)
      .map((request) => queryOf(request.url)["after"]);

  it("resumes from a remembered Event id, yields only newer Events and returns when caught up", async () => {
    const clock = createFakeClock();
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        EVENTS_ROUTE,
        pageReply([event("evt_03"), event("evt_04")], "evt_04"),
        // `nextCursor` is null at the current end, so it gives no
        // resume point; the tail keeps the last id itself.
        pageReply([event("evt_05")], null),
      );

    const tail = clientOn(fake, { clock }).events.tail({
      after: "evt_02",
      type: "learner.certified",
      limit: 2,
    });
    expect(tail.lastEventId).toBe("evt_02");

    const eventIds: string[] = [];
    for await (const item of tail) {
      eventIds.push(item.eventId);
    }

    expect(eventIds).toEqual(["evt_03", "evt_04", "evt_05"]);
    expect(tail.lastEventId).toBe("evt_05");
    expect(
      fake.requestsTo(EVENTS_ROUTE).map((request) => queryOf(request.url)),
    ).toEqual([
      { limit: "2", after: "evt_02", type: "learner.certified" },
      { limit: "2", after: "evt_04", type: "learner.certified" },
    ]);
    expect(clock.sleeps).toEqual([]);
  });

  it("starts at the oldest retained Event when given no id", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(EVENTS_ROUTE, pageReply([event("evt_01")], null));

    const tail = clientOn(fake).events.tail();
    expect(tail.lastEventId).toBeNull();

    const eventIds: string[] = [];
    for await (const item of tail) {
      eventIds.push(item.eventId);
    }

    expect(eventIds).toEqual(["evt_01"]);
    expect(afterParams(fake)).toEqual([undefined]);
    expect(tail.lastEventId).toBe("evt_01");
  });

  it("in follow mode polls from its last-seen id every 2 seconds until the signal aborts", async () => {
    const clock = createFakeClock();
    const controller = new AbortController();
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        EVENTS_ROUTE,
        pageReply([event("evt_03")], null),
        pageReply([], null),
        pageReply([event("evt_04"), event("evt_05")], null),
      );

    const tail = clientOn(fake, { clock }).events.tail({
      after: "evt_02",
      follow: true,
      signal: controller.signal,
    });
    const eventIds: string[] = [];
    for await (const item of tail) {
      eventIds.push(item.eventId);
      if (item.eventId === "evt_04") {
        controller.abort();
      }
    }

    // The abort lands mid-page: evt_05 was fetched but is never handed out,
    // so a resume from lastEventId picks it up.
    expect(eventIds).toEqual(["evt_03", "evt_04"]);
    expect(tail.lastEventId).toBe("evt_04");
    expect(afterParams(fake)).toEqual(["evt_02", "evt_03", "evt_03"]);
    expect(clock.sleeps).toEqual([2000, 2000]);
  });

  it("in follow mode waits the given interval and stops polling when the loop breaks", async () => {
    const clock = createFakeClock();
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(
        EVENTS_ROUTE,
        pageReply([], null),
        pageReply([event("evt_03")], null),
      );

    const tail = clientOn(fake, { clock }).events.tail({
      after: "evt_02",
      follow: true,
      interval: 250,
    });
    for await (const item of tail) {
      expect(item.eventId).toBe("evt_03");
      break;
    }

    expect(afterParams(fake)).toEqual(["evt_02", "evt_02"]);
    expect(clock.sleeps).toEqual([250]);
    expect(tail.lastEventId).toBe("evt_03");
  });

  it("ends without waiting out the interval when the signal aborts between polls", async () => {
    const controller = new AbortController();
    // A wait that never finishes on its own: only the abort can end it.
    const clock: Clock = {
      now: () => Date.UTC(2026, 10, 15, 12),
      sleep: () => {
        controller.abort();
        return new Promise(() => undefined);
      },
    };
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(EVENTS_ROUTE, pageReply([event("evt_03")], null));

    const eventIds: string[] = [];
    for await (const item of clientOn(fake, { clock }).events.tail({
      after: "evt_02",
      follow: true,
      signal: controller.signal,
    })) {
      eventIds.push(item.eventId);
    }

    expect(eventIds).toEqual(["evt_03"]);
    expect(fake.requestsTo(EVENTS_ROUTE)).toHaveLength(1);
  });
});
