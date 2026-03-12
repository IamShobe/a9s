import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { EventBridgeRowMetaSchema } from "../schema.js";
import { EventBridgeYankOptions } from "./yankOptions.js";

export function createEventBridgeYankCapability(): YankCapability {
  return createYankCapability(EventBridgeYankOptions, EventBridgeRowMetaSchema, {});
}
