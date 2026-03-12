import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { RDSRowMetaSchema } from "../schema.js";
import { RDSYankOptions } from "./yankOptions.js";

export function createRDSYankCapability(): YankCapability {
  return createYankCapability(RDSYankOptions, RDSRowMetaSchema, {});
}
