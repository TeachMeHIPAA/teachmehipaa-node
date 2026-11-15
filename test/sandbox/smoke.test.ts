import { describe, expect, it } from "vitest";
import TeachMeHipaa from "../../src/index.js";

const clientId = process.env.TMH_SANDBOX_CLIENT_ID;
const clientSecret = process.env.TMH_SANDBOX_CLIENT_SECRET;
const credentials =
  clientId !== undefined &&
  clientId !== "" &&
  clientSecret !== undefined &&
  clientSecret !== ""
    ? { clientId, clientSecret }
    : null;

// Read-only calls against the real Sandbox, run by hand with
// `npm run test:sandbox`. Without credentials every test is skipped.
describe.skipIf(credentials === null)("Sandbox smoke test", () => {
  const client = (): TeachMeHipaa => {
    if (credentials === null) {
      throw new Error("Sandbox credentials are not set");
    }
    return new TeachMeHipaa({ ...credentials, environment: "sandbox" });
  };

  it("introspects the Access token for an Organization in Sandbox mode", async () => {
    const introspection = await client().auth.introspect();

    expect(introspection.mode).toBe("test");
    expect(introspection.orgId).toEqual(expect.any(String));
  });

  it("lists Courses", async () => {
    const page = await client().courses.list({ limit: 5 });

    expect(Array.isArray(page.items)).toBe(true);
  });

  it("lists Learners", async () => {
    const page = await client().learners.list({ limit: 5 });

    expect(Array.isArray(page.items)).toBe(true);
    expect(page.lastResponse.status).toBe(200);
  });
});
