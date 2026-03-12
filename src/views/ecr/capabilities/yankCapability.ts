import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { ECRRowMetaSchema } from "../schema.js";
import { ECRYankOptions } from "./yankOptions.js";

export function createECRYankCapability(): YankCapability {
  return createYankCapability(ECRYankOptions, ECRRowMetaSchema, {});
}
