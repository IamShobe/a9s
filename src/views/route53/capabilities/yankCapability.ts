import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { Route53RowMetaSchema } from "../schema.js";
import { Route53YankOptions } from "./yankOptions.js";

export function createRoute53YankCapability(): YankCapability {
  return createYankCapability(Route53YankOptions, Route53RowMetaSchema, {});
}
