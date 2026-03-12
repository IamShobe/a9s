import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { SFNRowMetaSchema } from "../schema.js";
import { SFNYankOptions } from "./yankOptions.js";

export function createSFNYankCapability(): YankCapability {
  return createYankCapability(SFNYankOptions, SFNRowMetaSchema, {});
}
