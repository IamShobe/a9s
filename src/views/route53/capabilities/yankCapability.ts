import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import type { Route53Level, Route53RowMeta } from "../types.js";
import { Route53RowMetaSchema } from "../schema.js";
import { Route53YankOptions } from "./yankOptions.js";

export function createRoute53YankCapability(
  _region?: string,
  _getLevel?: () => Route53Level,
): YankCapability {
  return createYankCapability(Route53YankOptions, Route53RowMetaSchema, {});
}
