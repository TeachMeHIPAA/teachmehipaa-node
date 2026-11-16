// Syncs a roster from your own system into the Sandbox Organization, keyed
// by External ID, then lists Learners who are no longer on it.
// Run: npx tsx examples/sync-roster.ts
import TeachMeHipaa, { TeachMeHipaaError } from "teachmehipaa";

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    console.error(`Set ${name} to your Sandbox API client's credentials.`);
    process.exit(1);
  }
  return value;
};

/** Stands in for your HR system: each person's own id, email and name. */
const roster = [
  { employeeId: "hr-1001", email: "ana@example.com", name: "Ana Example" },
  { employeeId: "hr-1002", email: "ben@example.com", name: "Ben Example" },
  { employeeId: "hr-1003", email: "cy@example.com", name: "Cy Example" },
];

const client = new TeachMeHipaa({
  clientId: requireEnv("TMH_CLIENT_ID"),
  clientSecret: requireEnv("TMH_CLIENT_SECRET"),
  environment: "sandbox",
  appInfo: { name: "roster-sync-example" },
});

// upsertByExternalId invites a person the first time and returns them every
// time after, so the whole sync is safe to run again after a failure.
const outcomes = await Promise.allSettled(
  roster.map((person) =>
    client.learners.upsertByExternalId(person.employeeId, {
      email: person.email,
      name: person.name,
    }),
  ),
);

outcomes.forEach((outcome, index) => {
  const person = roster[index];
  if (outcome.status === "fulfilled") {
    const verb = outcome.value.created ? "invited" : "already enrolled";
    console.log(`${person?.employeeId ?? ""}: ${verb}`);
  } else if (outcome.reason instanceof TeachMeHipaaError) {
    const { code, requestId } = outcome.reason;
    console.error(
      `${person?.employeeId ?? ""}: failed (${String(code)}, request ${String(requestId)})`,
    );
  } else {
    throw outcome.reason;
  }
});

const onRoster = new Set(roster.map((person) => person.employeeId));
for await (const learner of client.learners.list({ limit: 100 })) {
  if (learner.externalId !== null && !onRoster.has(learner.externalId)) {
    // Offboarding is permanent, so this example only reports the Learner.
    // Call client.learners.offboard(learner.learnerId) to remove them.
    console.log(`${learner.externalId}: no longer on the roster`);
  }
}
