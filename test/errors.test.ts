import { describe, expect, it } from "vitest";
import TeachMeHipaa, { TeachMeHipaaError } from "../src/index.js";
import {
  createFakeTransport,
  type ScriptedReply,
} from "./support/fake-transport.js";
import {
  CLIENT_ID,
  CLIENT_SECRET,
  LEARNER_ID,
  LEARNER_ROUTE,
  ORG_ID,
  TOKEN_ROUTE,
  tokenReply,
} from "./support/fixtures.js";

const REQUEST_ID = "req-404-abc";

const retrieveFailingWith = async (reply: ScriptedReply): Promise<unknown> => {
  const fake = createFakeTransport()
    .script(TOKEN_ROUTE, tokenReply())
    .script(LEARNER_ROUTE, reply);
  const client = new TeachMeHipaa({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    organizationId: ORG_ID,
    transport: fake.transport,
  });
  return client.learners.retrieve(LEARNER_ID).then(
    () => expect.fail("expected the call to be rejected"),
    (error: unknown) => error,
  );
};

describe("Errors", () => {
  it("raises a problem+json response as a TeachMeHipaaError", async () => {
    const error = await retrieveFailingWith({
      status: 404,
      headers: {
        "content-type": "application/problem+json",
        "x-request-id": REQUEST_ID,
      },
      json: {
        title: "Not Found",
        status: 404,
        code: "not_found",
        detail: "No such learner.",
      },
    });

    expect(error).toBeInstanceOf(TeachMeHipaaError);
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({
      status: 404,
      code: "not_found",
      title: "Not Found",
      detail: "No such learner.",
      requestId: REQUEST_ID,
      errors: [],
    });
    expect((error as TeachMeHipaaError).headers["x-request-id"]).toBe(
      REQUEST_ID,
    );
  });

  it("carries field errors from a validation problem", async () => {
    const error = await retrieveFailingWith({
      status: 422,
      headers: { "content-type": "application/problem+json" },
      json: {
        title: "Unprocessable Entity",
        status: 422,
        code: "validation_failed",
        errors: [{ path: "courseId", message: "Too long" }],
      },
    });

    expect(error).toMatchObject({
      status: 422,
      code: "validation_failed",
      detail: null,
      errors: [{ path: "courseId", message: "Too long" }],
    });
  });

  it("raises a 200 HTML page as a TeachMeHipaaError instead of a parse crash", async () => {
    const error = await retrieveFailingWith({
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
      body: "<!DOCTYPE html><html><body>Not here</body></html>",
    });

    expect(error).toBeInstanceOf(TeachMeHipaaError);
    expect(error).toMatchObject({
      status: 200,
      code: null,
      raw: "<!DOCTYPE html><html><body>Not here</body></html>",
    });
  });
});
