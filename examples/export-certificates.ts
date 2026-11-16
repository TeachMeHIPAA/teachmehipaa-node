// Exports the Sandbox Organization's Certificates to a CSV file.
// Run: npx tsx examples/export-certificates.ts [output.csv]
import { writeFile } from "node:fs/promises";
import TeachMeHipaa, {
  OperationFailedError,
  OperationTimeoutError,
} from "@teachmehipaa/node";

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

const operation = await client.certificates.export({ format: "csv" });
console.log(`Started ${operation.name}`);

try {
  const done = await operation.wait({ timeout: 10 * 60_000 });
  const { csv, filename, rowCount } = done.exportResult();
  const path = process.argv[2] ?? filename ?? "certificates.csv";
  await writeFile(path, csv);
  console.log(`Wrote ${String(rowCount)} Certificates to ${path}`);
} catch (error) {
  if (error instanceof OperationFailedError) {
    console.error(
      `Export failed: ${String(error.code)} ${String(error.detail)}`,
    );
    process.exit(1);
  }
  if (error instanceof OperationTimeoutError) {
    // The export keeps running; wait on error.operation again, or fetch it
    // later by its name with client.operations.retrieve.
    console.error(`Still running after 10 minutes: ${error.operation.name}`);
    process.exit(1);
  }
  throw error;
}
