import Ajv2020 from "ajv/dist/2020.js";
import type { Ir } from "./ir.ts";

/**
 * Checks the IR against its vendored JSON Schema, so a newer IR shape fails
 * here with the schema's own message instead of as broken generated code.
 */
export const validateIr = (ir: unknown, schema: object): Ir => {
  // `strict: false` because the schema uses `format: uri`, which only needs
  // to be tolerated, not checked.
  const validate = new Ajv2020({
    strict: false,
    validateFormats: false,
    allErrors: true,
  }).compile(schema);
  if (!validate(ir)) {
    const problems = (validate.errors ?? [])
      .slice(0, 10)
      .map((error) => `  ${error.instancePath || "/"} ${error.message ?? ""}`)
      .join("\n");
    throw new Error(
      `openapi/sdk-ir.json does not match its schema:\n${problems}`,
    );
  }
  return ir as Ir;
};
