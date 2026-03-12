import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { ECSRowMetaSchema } from "../schema.js";
import { ECSYankOptions } from "./yankOptions.js";

export function createECSYankCapability(): YankCapability {
  return createYankCapability(ECSYankOptions, ECSRowMetaSchema, {});
}
