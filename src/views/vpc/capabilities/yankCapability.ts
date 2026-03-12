import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { VPCRowMetaSchema } from "../schema.js";
import { VPCYankOptions } from "./yankOptions.js";

export function createVPCYankCapability(): YankCapability {
  return createYankCapability(VPCYankOptions, VPCRowMetaSchema, {});
}
