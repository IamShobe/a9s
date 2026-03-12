import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { SSMRowMetaSchema } from "../schema.js";
import { buildSSMYankOptions } from "./yankOptions.js";
import { buildRegionArgs } from "../../../utils/aws.js";

export function createSSMYankCapability(region?: string): YankCapability {
  const regionArgs = buildRegionArgs(region);
  const options = buildSSMYankOptions(regionArgs);
  return createYankCapability(options, SSMRowMetaSchema, { regionArgs });
}
