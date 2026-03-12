import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { SNSRowMetaSchema } from "../schema.js";
import { SNSYankOptions } from "./yankOptions.js";

export function createSNSYankCapability(): YankCapability {
  return createYankCapability(SNSYankOptions, SNSRowMetaSchema, {});
}
