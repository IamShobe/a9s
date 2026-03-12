import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { ELBRowMetaSchema } from "../schema.js";
import { ELBYankOptions } from "./yankOptions.js";

export function createELBYankCapability(): YankCapability {
  return createYankCapability(ELBYankOptions, ELBRowMetaSchema, {});
}
