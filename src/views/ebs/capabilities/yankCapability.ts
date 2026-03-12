import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { EBSRowMetaSchema } from "../schema.js";
import { EBSYankOptions } from "./yankOptions.js";

export function createEBSYankCapability(): YankCapability {
  return createYankCapability(EBSYankOptions, EBSRowMetaSchema, {});
}
