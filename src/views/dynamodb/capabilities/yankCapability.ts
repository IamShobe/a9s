import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import type { DynamoDBLevel, DynamoDBRowMeta } from "../types.js";
import { DynamoDBRowMetaSchema } from "../schema.js";
import { DynamoDBYankOptions } from "./yankOptions.js";

export function createDynamoDBYankCapability(
  _region?: string,
  _getLevel?: () => DynamoDBLevel,
): YankCapability {
  return createYankCapability(DynamoDBYankOptions, DynamoDBRowMetaSchema, {});
}
