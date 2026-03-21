import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { CloudFrontRowMetaSchema } from "../schema.js";
import { CloudFrontYankOptions } from "./yankOptions.js";

export function createCloudFrontYankCapability(): YankCapability {
  return createYankCapability(CloudFrontYankOptions, CloudFrontRowMetaSchema, {});
}
