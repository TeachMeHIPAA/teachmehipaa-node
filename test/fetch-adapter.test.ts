import { describe, expect, it } from "vitest";
import TeachMeHipaa, { type TeachMeHipaaOptions } from "../src/index.js";
import { createFakeTransport } from "./support/fake-transport.js";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  LEARNER_ID,
  LEARNER_ROUTE,
  ORG_ID,
  TOKEN_ROUTE,
  learnerBody,
  learnerReply,
  tokenReply,
} from "./support/fixtures.js";

interface FetchCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

describe("fetch adapter", () => {
  it("sends requests through a custom fetch", async () => {
    // The scripted fake answers; the custom fetch is what the client calls.
    const fake = createFakeTransport()
      .script(TOKEN_ROUTE, tokenReply())
      .script(LEARNER_ROUTE, learnerReply());
    const calls: FetchCall[] = [];
    const customFetch = (async (input: string, init?: RequestInit) => {
      calls.push({ url: input, init });
      return fake.transport({
        method: (init?.method ?? "GET") as "GET" | "POST",
        url: input,
        headers: init?.headers as Record<string, string>,
        ...(typeof init?.body === "string" ? { body: init.body } : {}),
        timeout: 0,
      });
    }) as typeof fetch;
    const client = new TeachMeHipaa({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      organizationId: ORG_ID,
      fetch: customFetch,
    });

    const learner = await client.learners.retrieve(LEARNER_ID);

    expect(learner).toEqual(learnerBody);
    expect(calls.map((call) => [call.init?.method, call.url])).toEqual([
      ["POST", "https://api.tme.so/v1/auth/token"],
      [
        "GET",
        `https://api.tme.so/v1/organizations/${ORG_ID}/learners/${LEARNER_ID}`,
      ],
    ]);
    expect(calls[0]?.init?.body).toBe("grant_type=client_credentials");
    expect(calls[1]?.init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("refuses both fetch and transport", () => {
    const options = {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      fetch: globalThis.fetch,
      transport: createFakeTransport().transport,
    } as TeachMeHipaaOptions;

    expect(() => new TeachMeHipaa(options)).toThrow(/fetch.*transport/);
  });
});
