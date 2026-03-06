import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { IamRowMetaSchema } from "../schema.js";
import { iamYankOptions } from "./yankOptions.js";

export function createIamYankCapability(): YankCapability {
  return createYankCapability(iamYankOptions, IamRowMetaSchema, {});
}
