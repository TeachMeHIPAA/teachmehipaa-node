// Prints the Sandbox Organization's Compliance summary and its first few
// Learners. Run: npx tsx examples/quickstart.ts
import TeachMeHipaa from "teachmehipaa";

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    console.error(`Set ${name} to your Sandbox API client's credentials.`);
    process.exit(1);
  }
  return value;
};

const client = new TeachMeHipaa({
  clientId: requireEnv("TMH_CLIENT_ID"),
  clientSecret: requireEnv("TMH_CLIENT_SECRET"),
  environment: "sandbox",
});

const summary = await client.compliance.retrieve();
console.log(
  `Course ${summary.courseId}: ${String(summary.totals.compliant)} of ${String(summary.totals.learners)} Learners compliant`,
);

const learners = await client.learners.list().autoPagingToArray({ limit: 5 });
for (const learner of learners) {
  console.log(`${learner.email}\t${learner.status}`);
}
