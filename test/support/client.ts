import TeachMeHipaa, {
  type ClientCredentialsOptions,
} from "../../src/index.js";
import { createFakeClock } from "./fake-clock.js";
import type { FakeTransport } from "./fake-transport.js";
import { CLIENT_ID, CLIENT_SECRET, ORG_ID } from "./fixtures.js";

/** Client options to change; `organizationId: null` leaves it to introspection. */
export type ClientOverrides = Partial<
  Omit<ClientCredentialsOptions, "organizationId">
> & { readonly organizationId?: string | null };

/**
 * A client-credentials client bound to `ORG_ID` that sends through `fake`
 * and sleeps on a fake clock.
 */
export const clientOn = (
  fake: FakeTransport,
  { organizationId = ORG_ID, ...overrides }: ClientOverrides = {},
): TeachMeHipaa =>
  new TeachMeHipaa({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    ...(organizationId === null ? {} : { organizationId }),
    transport: fake.transport,
    clock: createFakeClock(),
    ...overrides,
  });

/** Lets promise callbacks and zero-delay timers run before the test goes on. */
export const flushPendingWork = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));
