import type { YankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { createYankCapability } from "../../../adapters/capabilities/YankCapability.js";
import { ApiGatewayRowMetaSchema } from "../schema.js";
import { ApiGatewayYankOptions } from "./yankOptions.js";

export function createApiGatewayYankCapability(): YankCapability {
  return createYankCapability(ApiGatewayYankOptions, ApiGatewayRowMetaSchema, {});
}
