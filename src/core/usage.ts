// Mistakes in how the library is called are programming errors, so they
// raise plain `TypeError`s rather than a `TeachMeHipaaError`, all with one
// prefix that says where they came from.
const PREFIX = "teachmehipaa: ";

export const prefixed = (message: string): string => `${PREFIX}${message}`;

export const usageError = (message: string): TypeError =>
  new TypeError(prefixed(message));

/**
 * Checks the options a caller passed; `scope` names the function they went
 * to, when that isn't the client constructor.
 */
export const optionsValidator = (scope?: string) => {
  const invalid = (message: string): TypeError =>
    usageError(scope === undefined ? message : `${scope}: ${message}`);
  const requireNonEmptyString = (value: unknown, name: string): string => {
    if (typeof value !== "string" || value.trim() === "") {
      throw invalid(`${name} must be a non-empty string`);
    }
    return value;
  };
  return { invalid, requireNonEmptyString };
};
