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
  learnerReply,
  tokenReply,
} from "./support/fixtures.js";

const scriptedRetrieve = () =>
  createFakeTransport()
    .script(TOKEN_ROUTE, tokenReply())
    .script(LEARNER_ROUTE, learnerReply());

const urlsSentBy = async (
  options: Omit<TeachMeHipaaOptions, "clientId" | "clientSecret" | "transport">,
): Promise<readonly string[]> => {
  const fake = scriptedRetrieve();
  const client = new TeachMeHipaa({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    organizationId: ORG_ID,
    transport: fake.transport,
    ...options,
  });
  await client.learners.retrieve(LEARNER_ID);
  return fake.requests.map((request) => request.url);
};

describe("Client configuration", () => {
  it("talks to the Live Environment by default", async () => {
    expect(await urlsSentBy({})).toEqual([
      "https://api.tme.so/v1/auth/token",
      `https://api.tme.so/v1/organizations/${ORG_ID}/learners/${LEARNER_ID}`,
    ]);
  });

  it("talks to the Sandbox Environment when asked", async () => {
    expect(await urlsSentBy({ environment: "sandbox" })).toEqual([
      "https://api-teachmehipaa-dev.web.app/v1/auth/token",
      `https://api-teachmehipaa-dev.web.app/v1/organizations/${ORG_ID}/learners/${LEARNER_ID}`,
    ]);
  });

  it("prefers an explicit baseUrl over the Environment", async () => {
    expect(
      await urlsSentBy({
        environment: "sandbox",
        baseUrl: "http://localhost:4010/v1/",
      }),
    ).toEqual([
      "http://localhost:4010/v1/auth/token",
      `http://localhost:4010/v1/organizations/${ORG_ID}/learners/${LEARNER_ID}`,
    ]);
  });

  it("ignores changes made to the options object after construction", async () => {
    const fake = scriptedRetrieve();
    const scopes = ["learners:read"];
    const options = {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      organizationId: ORG_ID,
      scopes,
      transport: fake.transport,
    };
    const client = new TeachMeHipaa(options);

    options.organizationId = "org_other";
    options.clientSecret = "tmh_cs_changed";
    scopes.push("learners:write");
    await client.learners.retrieve(LEARNER_ID);

    const [tokenRequest, retrieve] = fake.requests;
    expect(new URLSearchParams(tokenRequest?.body).get("scope")).toBe(
      "learners:read",
    );
    expect(tokenRequest?.headers.authorization).toBe(
      `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
    );
    expect(retrieve?.url).toContain(`/organizations/${ORG_ID}/`);
  });

  it.each([
    ["a missing clientId", { clientSecret: CLIENT_SECRET }, /clientId/],
    [
      "an empty clientSecret",
      { clientId: CLIENT_ID, clientSecret: "" },
      /clientSecret/,
    ],
    [
      "an unknown Environment",
      { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, environment: "test" },
      /environment/,
    ],
    [
      "a baseUrl that is not a URL",
      {
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        baseUrl: "api.tme.so",
      },
      /baseUrl/,
    ],
    [
      "a negative maxRetries",
      { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, maxRetries: -1 },
      /maxRetries/,
    ],
    [
      "a zero timeout",
      { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, timeout: 0 },
      /timeout/,
    ],
    [
      "an appInfo without a name",
      {
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        appInfo: { version: "1" },
      },
      /appInfo\.name/,
    ],
    [
      "an unknown option",
      { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, apiKey: "sk_live" },
      /apiKey/,
    ],
  ])("rejects %s", (_, options, message) => {
    expect(
      () => new TeachMeHipaa(options as unknown as TeachMeHipaaOptions),
    ).toThrow(message);
  });
});
