// What README samples import as "teachmehipaa" when the README test runs
// them: the real library, with every client wired to the test's fake
// transport and clock instead of the network.
import {
  TeachMeHipaa as RealTeachMeHipaa,
  type Clock,
  type TeachMeHipaaOptions,
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
// to the fake. A sample that brings its own transport (the testing guide's)
// keeps it, since that transport is what it shows.
const withFakes = (options: TeachMeHipaaOptions): TeachMeHipaaOptions => {
  const { transport, clock } = fakes();
  return {
    ...(Object.fromEntries(
      Object.entries(options).filter(([name]) => name !== "fetch"),
    ) as TeachMeHipaaOptions),
    transport: options.transport ?? transport,
    clock,
  };
};

export class TeachMeHipaa extends RealTeachMeHipaa {
  constructor(options: TeachMeHipaaOptions) {
    super(withFakes(options));
  }
}

export default TeachMeHipaa;
