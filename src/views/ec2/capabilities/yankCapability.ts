import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { EC2RowMetaSchema } from "../schema.js";
import { EC2YankOptions } from "./yankOptions.js";

export function createEC2YankCapability(): YankCapability {
  return createYankCapability(EC2YankOptions, EC2RowMetaSchema, {});
}
