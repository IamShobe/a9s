import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { SQSRowMetaSchema } from "../schema.js";
import { SQSYankOptions } from "./yankOptions.js";

export function createSQSYankCapability(): YankCapability {
  return createYankCapability(SQSYankOptions, SQSRowMetaSchema, {});
}
