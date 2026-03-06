import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { SecretRowMetaSchema } from "../schema.js";
import { secretYankOptions, type SecretYankCtx } from "./yankOptions.js";
import type { SecretLevel } from "../types.js";

export function createSecretsManagerYankCapability(
  region?: string,
  getLevel?: () => SecretLevel,
): YankCapability {
  const ctx: SecretYankCtx = { region, getLevel };
  return createYankCapability(secretYankOptions, SecretRowMetaSchema, ctx);
}
