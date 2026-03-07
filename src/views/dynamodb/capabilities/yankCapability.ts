import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { DynamoDBRowMetaSchema } from "../schema.js";
import { DynamoDBYankOptions } from "./yankOptions.js";

export function createDynamoDBYankCapability(): YankCapability {
  return createYankCapability(DynamoDBYankOptions, DynamoDBRowMetaSchema, {});
}
