// Receives and verifies webhook Deliveries with Express, and looks up each
// certified Learner in the Sandbox.
// Run: npx tsx examples/webhook-server.ts, then point a Webhook subscription
// at http(s)://<your host>/webhooks/tmh (for example through a tunnel).
import express from "express";
import TeachMeHipaa, { WebhookSignatureError, webhooks } from "teachmehipaa";

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    console.error(`Set ${name}.`);
    process.exit(1);
  }
  return value;
};

const signingSecret = requireEnv("TMH_WEBHOOK_SECRET");
const client = new TeachMeHipaa({
  clientId: requireEnv("TMH_CLIENT_ID"),
  clientSecret: requireEnv("TMH_CLIENT_SECRET"),
  environment: "sandbox",
});

const app = express();

// The signature covers the exact bytes sent, so this route reads the raw
// body; a JSON parser in front of it would make every Delivery fail.
app.post(
  "/webhooks/tmh",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const event = await webhooks
      .constructEvent(
        req.body as Buffer,
        req.headers,
        signingSecret,
        req.originalUrl,
      )
      .catch((error: unknown) => {
        if (error instanceof WebhookSignatureError) {
          return error;
        }
        throw error;
      });
    if (event instanceof WebhookSignatureError) {
      res.status(400).send(event.code);
      return;
    }

    // Answer before doing any work, so a slow lookup never makes
    // TeachMeHIPAA retry the Delivery.
    res.sendStatus(200);

    if ("test" in event) {
      console.log(`Test delivery for ${event.subscriptionId}`);
      return;
    }
    console.log(`${event.eventType} ${event.eventId}`);
    if (event.eventType === "learner.certified") {
      // The type also admits an UnknownEvent, whose data is untyped, so the
      // id is checked before use.
      const { learnerId } = event.data;
      if (typeof learnerId === "string") {
        const learner = await client.learners.retrieve(learnerId);
        console.log(
          `${learner.email} is certified until ${learner.certificate?.expiresAt ?? "unknown"}`,
        );
      }
    }
  },
);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Listening on http://localhost:${String(port)}/webhooks/tmh`);
});
