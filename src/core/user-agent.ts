import { VERSION } from "../version.js";

/** Identifies your integration to TeachMeHIPAA in the User-Agent. */
export interface AppInfo {
  readonly name: string;
  readonly version?: string;
  readonly url?: string;
}

const runtime = (): string => {
  // Bun and Deno both provide `process.versions` and add their own entry.
  const versions: Readonly<Record<string, string | undefined>> =
    process.versions;
  if (versions.bun !== undefined) return `bun/${versions.bun}`;
  if (versions.deno !== undefined) return `deno/${versions.deno}`;
  return `node/${process.versions.node}`;
};

const describeApp = (app: AppInfo): string =>
  [
    app.version === undefined ? app.name : `${app.name}/${app.version}`,
    ...(app.url === undefined ? [] : [`(+${app.url})`]),
  ].join(" ");

// ADR-0007: this header is the only thing the SDK says about its caller.
export const buildUserAgent = (app: AppInfo | undefined): string =>
  [
    `teachmehipaa-node/${VERSION}`,
    runtime(),
    ...(app ? [describeApp(app)] : []),
  ].join(" ");
