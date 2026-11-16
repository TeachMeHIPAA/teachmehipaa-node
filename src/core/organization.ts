/**
 * The Organization a client acts for (ADR-0003). Resolved at most once, and
 * concurrent first calls share one lookup.
 */
export interface OrganizationBinding {
  organizationId(): Promise<string>;
}

export const createOrganizationBinding = (
  lookUp: () => Promise<string>,
  knownOrganizationId: string | undefined,
): OrganizationBinding => {
  let resolved =
    knownOrganizationId === undefined
      ? undefined
      : Promise.resolve(knownOrganizationId);
  return {
    organizationId() {
      resolved ??= lookUp().catch((error: unknown) => {
        resolved = undefined;
        throw error;
      });
      return resolved;
    },
  };
};
