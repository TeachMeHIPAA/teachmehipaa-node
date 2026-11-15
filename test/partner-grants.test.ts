import { describe, expect, it } from "vitest";
import TeachMeHipaa, {
  ConnectionError,
  OAuthError,
  partnerGrantTokenProvider,
  type PartnerGrantOptions,
  type TokenStore,
  type Transport,
} from "../src/index.js";
import { createFakeClock, type FakeClock } from "./support/fake-clock.js";
import {
  createFakeTransport,
  textBody,
  type FakeTransport,
  type ScriptedReply,
} from "./support/fake-transport.js";
import {
  APP_BASIC_AUTHORIZATION,
  APP_ID,
  APP_SECRET,
  LEARNER_ID,
  LEARNER_ROUTE,
  ORG_ID,
  REFRESH_TOKEN_1,
  REFRESH_TOKEN_2,
  REFRESH_TOKEN_3,
  TOKEN_ROUTE,
  grantTokenReply,
  learnerReply,
  oauthErrorReply,
} from "./support/fixtures.js";

const SECOND = 1000;

const flushPendingWork = () => new Promise((resolve) => setTimeout(resolve, 0));

const refreshTokensSent = (fake: FakeTransport): readonly (string | null)[] =>
  fake
    .requestsTo(TOKEN_ROUTE)
    .map((request) =>
      new URLSearchParams(textBody(request)).get("refresh_token"),
    );

const grantClient = (
  fake: FakeTransport,
  tokenStore: TokenStore,
  options: Partial<PartnerGrantOptions> & { readonly clock?: FakeClock } = {},
) =>
  new TeachMeHipaa({
    tokenProvider: partnerGrantTokenProvider({
      clientId: APP_ID,
      clientSecret: APP_SECRET,
      tokenStore,
      transport: fake.transport,
      ...options,
    }),
    organizationId: ORG_ID,
    transport: fake.transport,
    ...(options.clock === undefined ? {} : { clock: options.clock }),
  });

/**
 * A token store that writes to a shared log, in order. It saves a tick late,
 * like a database, so a save that isn't awaited shows up after the request.
 */
const createMemoryStore = (
  log: string[],
  initial: string = REFRESH_TOKEN_1,
): TokenStore & { readonly saved: readonly string[] } => {
  const saved: string[] = [];
  return {
    saved,
    load: () => saved.at(-1) ?? initial,
    save: async (refreshToken) => {
      await flushPendingWork();
      log.push(`save ${refreshToken}`);
      saved.push(refreshToken);
    },
  };
};

const logged = (transport: Transport, log: string[]): Transport => {
  return (request) => {
    log.push(`${request.method} ${new URL(request.url).pathname}`);
    return transport(request);
  };
};

describe("Partner Grants", () => {
  it("saves the rotated Refresh token before the API request is sent", async () => {
    const log: string[] = [];
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, grantTokenReply("jwt-org", REFRESH_TOKEN_2))
      .script(LEARNER_ROUTE, learnerReply());
    const transport = logged(fake.transport, log);
    const tokenStore = createMemoryStore(log);
    const client = new TeachMeHipaa({
      tokenProvider: partnerGrantTokenProvider({
        clientId: APP_ID,
        clientSecret: APP_SECRET,
        tokenStore,
        transport,
      }),
      organizationId: ORG_ID,
      transport,
    });

    await client.learners.retrieve(LEARNER_ID);

    expect(log).toEqual([
      TOKEN_ROUTE,
      `save ${REFRESH_TOKEN_2}`,
      LEARNER_ROUTE,
    ]);
    const [exchange] = fake.requestsTo(TOKEN_ROUTE);
    expect(exchange?.headers.authorization).toBe(APP_BASIC_AUTHORIZATION);
    expect(Object.fromEntries(new URLSearchParams(textBody(exchange)))).toEqual(
      { grant_type: "refresh_token", refresh_token: REFRESH_TOKEN_1 },
    );
    expect(fake.requestsTo(LEARNER_ROUTE)[0]?.headers.authorization).toBe(
      "Bearer jwt-org",
    );
  });

  it("aborts the call without using the Access token when the store can't save", async () => {
    const fake = createFakeTransport().script(
      TOKEN_ROUTE,
      grantTokenReply("jwt-org", REFRESH_TOKEN_2),
    );
    const storeFailure = new Error("database is read-only");
    const client = grantClient(fake, {
      load: () => REFRESH_TOKEN_1,
      save: () => Promise.reject(storeFailure),
    });

    const call = client.learners.retrieve(LEARNER_ID);

    await expect(call).rejects.toThrow(/tokenStore\.save\(\) failed/);
    await expect(call).rejects.toMatchObject({ cause: storeFailure });
    expect(fake.requestsTo(LEARNER_ROUTE)).toHaveLength(0);
  });

  it("presents the rotated Refresh token, never the superseded one, after a failed save", async () => {
    const fake = createFakeTransport()
      .script(
        TOKEN_ROUTE,
        grantTokenReply("jwt-1", REFRESH_TOKEN_2),
        grantTokenReply("jwt-2", REFRESH_TOKEN_3),
      )
      .script(LEARNER_ROUTE, learnerReply());
    const saves: string[] = [];
    const client = grantClient(fake, {
      load: () => REFRESH_TOKEN_1,
      save: (refreshToken) => {
        saves.push(refreshToken);
        if (saves.length === 1) {
          throw new Error("database is read-only");
        }
      },
    });

    await expect(client.learners.retrieve(LEARNER_ID)).rejects.toThrow();
    await client.learners.retrieve(LEARNER_ID);

    expect(refreshTokensSent(fake)).toEqual([REFRESH_TOKEN_1, REFRESH_TOKEN_2]);
    expect(saves).toEqual([REFRESH_TOKEN_2, REFRESH_TOKEN_3]);
  });

  it("makes a single exchange attempt when the network fails during refresh", async () => {
    const fake = createFakeTransport().script(TOKEN_ROUTE, () => {
      throw new TypeError("fetch failed");
    });
    const tokenStore = createMemoryStore([]);
    const client = grantClient(fake, tokenStore);

    const call = client.learners.retrieve(LEARNER_ID);

    await expect(call).rejects.toBeInstanceOf(ConnectionError);
    await expect(call).rejects.toThrow(/not retried/);
    await expect(call).rejects.toThrow(/re-run consent/);
    expect(fake.requestsTo(TOKEN_ROUTE)).toHaveLength(1);
    expect(tokenStore.saved).toEqual([]);
  });

  it("says the Grant was revoked or its Refresh token reused on invalid_grant", async () => {
    const fake = createFakeTransport().script(
      TOKEN_ROUTE,
      oauthErrorReply("invalid_grant", "Refresh token is invalid"),
    );
    const client = grantClient(fake, createMemoryStore([]));

    const call = client.learners.retrieve(LEARNER_ID);

    await expect(call).rejects.toBeInstanceOf(OAuthError);
    await expect(call).rejects.toMatchObject({
      code: "invalid_grant",
      status: 400,
    });
    await expect(call).rejects.toThrow(/revoked/);
    await expect(call).rejects.toThrow(/reused/);
    await expect(call).rejects.toThrow(/Re-run consent/);
    expect(fake.requestsTo(TOKEN_ROUTE)).toHaveLength(1);
  });

  it("exchanges the Refresh token once for concurrent calls", async () => {
    let releaseToken: (reply: ScriptedReply) => void = () => undefined;
    const fake = createFakeTransport()
      .script(
        TOKEN_ROUTE,
        () => new Promise<ScriptedReply>((resolve) => (releaseToken = resolve)),
      )
      .script(LEARNER_ROUTE, learnerReply(), learnerReply());
    const tokenStore = createMemoryStore([]);
    const client = grantClient(fake, tokenStore);

    const both = Promise.all([
      client.learners.retrieve(LEARNER_ID),
      client.learners.retrieve(LEARNER_ID),
    ]);
    await flushPendingWork();
    releaseToken(grantTokenReply("jwt-org", REFRESH_TOKEN_2));
    await both;

    expect(fake.requestsTo(TOKEN_ROUTE)).toHaveLength(1);
    expect(tokenStore.saved).toEqual([REFRESH_TOKEN_2]);
  });

  it("re-mints 60 s before expiry with the rotated Refresh token", async () => {
    const clock = createFakeClock();
    const fake = createFakeTransport()
      .script(
        TOKEN_ROUTE,
        grantTokenReply("jwt-1", REFRESH_TOKEN_2, 900),
        grantTokenReply("jwt-2", REFRESH_TOKEN_3, 900),
      )
      .script(LEARNER_ROUTE, learnerReply(), learnerReply(), learnerReply());
    const tokenStore = createMemoryStore([]);
    const client = grantClient(fake, tokenStore, { clock });

    await client.learners.retrieve(LEARNER_ID);
    clock.advance(839 * SECOND);
    await client.learners.retrieve(LEARNER_ID);
    clock.advance(1 * SECOND);
    await client.learners.retrieve(LEARNER_ID);

    expect(refreshTokensSent(fake)).toEqual([REFRESH_TOKEN_1, REFRESH_TOKEN_2]);
    expect(tokenStore.saved).toEqual([REFRESH_TOKEN_2, REFRESH_TOKEN_3]);
    expect(
      fake.requestsTo(LEARNER_ROUTE).map((r) => r.headers.authorization),
    ).toEqual(["Bearer jwt-1", "Bearer jwt-1", "Bearer jwt-2"]);
  });

  it("re-mints once and replays when the API answers 401", async () => {
    const fake = createFakeTransport()
      .script(
        TOKEN_ROUTE,
        grantTokenReply("jwt-1", REFRESH_TOKEN_2),
        grantTokenReply("jwt-2", REFRESH_TOKEN_3),
      )
      .script(
        LEARNER_ROUTE,
        {
          status: 401,
          headers: { "content-type": "application/problem+json" },
          json: { code: "unauthorized", title: "Unauthorized" },
        },
        learnerReply(),
      );
    const client = grantClient(fake, createMemoryStore([]));

    await client.learners.retrieve(LEARNER_ID);

    expect(refreshTokensSent(fake)).toEqual([REFRESH_TOKEN_1, REFRESH_TOKEN_2]);
    expect(
      fake.requestsTo(LEARNER_ROUTE).map((r) => r.headers.authorization),
    ).toEqual(["Bearer jwt-1", "Bearer jwt-2"]);
  });

  it("uses a Refresh token passed up front for the first exchange", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, grantTokenReply("jwt-org", REFRESH_TOKEN_3))
      .script(LEARNER_ROUTE, learnerReply());
    const tokenStore = createMemoryStore([], "tmh_rt_never_loaded");

    await grantClient(fake, tokenStore, {
      refreshToken: REFRESH_TOKEN_2,
    }).learners.retrieve(LEARNER_ID);

    expect(refreshTokensSent(fake)).toEqual([REFRESH_TOKEN_2]);
    expect(tokenStore.saved).toEqual([REFRESH_TOKEN_3]);
  });

  it("narrows the Access token to the Scopes it is given", async () => {
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, grantTokenReply("jwt-org", REFRESH_TOKEN_2))
      .script(LEARNER_ROUTE, learnerReply());

    await grantClient(fake, createMemoryStore([]), {
      scopes: ["learners:read"],
    }).learners.retrieve(LEARNER_ID);

    expect(
      new URLSearchParams(textBody(fake.requestsTo(TOKEN_ROUTE)[0])).get(
        "scope",
      ),
    ).toBe("learners:read");
  });
});
