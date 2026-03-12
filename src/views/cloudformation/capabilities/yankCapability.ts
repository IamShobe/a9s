import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { CloudFormationRowMetaSchema } from "../schema.js";
import { CloudFormationYankOptions } from "./yankOptions.js";

export function createCloudFormationYankCapability(): YankCapability {
  return createYankCapability(CloudFormationYankOptions, CloudFormationRowMetaSchema, {});
}
