import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { LambdaRowMetaSchema } from "../schema.js";
import { LambdaYankOptions } from "./yankOptions.js";

export function createLambdaYankCapability(): YankCapability {
  return createYankCapability(LambdaYankOptions, LambdaRowMetaSchema, {});
}
