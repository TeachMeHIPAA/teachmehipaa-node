import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    prismUrl: string;
  }
}

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SPEC = "openapi/openapi.developer.json";
const PRISM = "node_modules/.bin/prism";
const STARTUP_TIMEOUT_MS = 60_000;

// Asking the OS for port 0 and releasing it is racy in theory, but Prism
// binds within milliseconds and the suite owns the machine in CI.
const freePort = async (): Promise<number> => {
  const server = createServer().listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  server.close();
  if (address === null || typeof address === "string") {
    throw new Error("Could not find a free port for Prism");
  }
  return address.port;
};

/**
 * Starts a Prism mock of the vendored developer spec for the contract suite,
 * serving static responses built from the spec's schemas and examples.
 *
 * Neither `--errors` nor `--dynamic` is used: both make Prism fail on its own
 * generated responses (static strings ignore `pattern`; dynamic numbers break
 * OpenAPI 3.1 `exclusiveMinimum`), which says nothing about the SDK. Prism
 * still answers a request that breaks the spec with a 4xx, which the SDK
 * raises, and names the broken rule in `sl-violations`.
 */
export default async function setup(project: TestProject) {
  const port = await freePort();
  const prism = spawn(
    PRISM,
    ["mock", SPEC, "--host", "127.0.0.1", "--port", String(port)],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
  );
  const output: string[] = [];
  const listening = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Prism did not start:\n${output.join("")}`));
    }, STARTUP_TIMEOUT_MS);
    const watch = (chunk: Buffer) => {
      output.push(chunk.toString());
      if (chunk.toString().includes("Prism is listening")) {
        clearTimeout(timer);
        resolve();
      }
    };
    prism.stdout.on("data", watch);
    prism.stderr.on("data", watch);
    prism.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Prism exited (${String(code)}):\n${output.join("")}`));
    });
  });
  await listening;
  project.provide("prismUrl", `http://127.0.0.1:${String(port)}`);
  return async () => {
    prism.removeAllListeners("exit");
    prism.kill();
    await once(prism, "exit");
  };
}
