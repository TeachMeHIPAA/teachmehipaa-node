// What README samples import as "teachmehipaa" when the README test runs
// them: the real library, with every client and token endpoint wired to the
// test's fake transport and clock instead of the network.
import {
  TeachMeHipaa as RealTeachMeHipaa,
  partnerGrantTokenProvider as realPartnerGrantTokenProvider,
  type Clock,
  type PartnerGrantOptions,
  type TeachMeHipaaOptions,
  type TokenProvider,
  type Transport,
} from "../../src/index.js";

export * from "../../src/index.js";

interface Fakes {
  readonly transport: Transport;
  readonly clock: Clock;
}

let current: Fakes | undefined;

export const useFakes = (fakes: Fakes): void => {
  current = fakes;
};

const fakes = (): Fakes => {
  if (current === undefined) {
    throw new Error("README test: call useFakes() before running a sample");
  }
  return current;
};

// `fetch` and `transport` are exclusive, so a sample's own `fetch` gives way
// to the fake.
const withFakes = <T extends object>(options: T): T & Fakes => ({
  ...(Object.fromEntries(
    Object.entries(options).filter(([name]) => name !== "fetch"),
  ) as T),
  ...fakes(),
});

export class TeachMeHipaa extends RealTeachMeHipaa {
  constructor(options: TeachMeHipaaOptions) {
    super(withFakes(options));
  }
}

export const partnerGrantTokenProvider = (
  options: PartnerGrantOptions,
): TokenProvider => realPartnerGrantTokenProvider(withFakes(options));

export default TeachMeHipaa;
