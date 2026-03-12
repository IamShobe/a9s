import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { CloudWatchRowMetaSchema } from "../schema.js";
import { CloudWatchYankOptions } from "./yankOptions.js";

export function createCloudWatchYankCapability(): YankCapability {
  return createYankCapability(CloudWatchYankOptions, CloudWatchRowMetaSchema, {});
}
