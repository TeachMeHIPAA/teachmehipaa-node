import { describe, expect, it } from "vitest";
import packageJson from "../package.json" with { type: "json" };
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

const userAgentsSentWith = async (
  appInfo?: TeachMeHipaaOptions["appInfo"],
): Promise<readonly (string | undefined)[]> => {
  const fake = createFakeTransport()
    .script(TOKEN_ROUTE, tokenReply())
    .script(LEARNER_ROUTE, learnerReply());
  const client = new TeachMeHipaa({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    organizationId: ORG_ID,
    transport: fake.transport,
    ...(appInfo === undefined ? {} : { appInfo }),
  });
  await client.learners.retrieve(LEARNER_ID);
  return fake.requests.map((request) => request.headers["user-agent"]);
};

const SDK_AND_RUNTIME = `teachmehipaa-node/${packageJson.version} node/${process.versions.node}`;

describe("User-Agent", () => {
  it("names the SDK version and runtime on every request", async () => {
    expect(await userAgentsSentWith()).toEqual([
      SDK_AND_RUNTIME,
      SDK_AND_RUNTIME,
    ]);
  });

  it("appends the caller's app info", async () => {
    const [userAgent] = await userAgentsSentWith({
      name: "AcmeHR",
      version: "4.2.0",
      url: "https://acme.example",
    });

    expect(userAgent).toBe(
      `${SDK_AND_RUNTIME} AcmeHR/4.2.0 (+https://acme.example)`,
    );
  });
});
