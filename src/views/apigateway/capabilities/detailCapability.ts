import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs, resolveRegion } from "../../../utils/aws.js";
import { debugLog } from "../../../utils/debugLogger.js";
import type { ApiGatewayLevel, ApiGatewayRowMeta, AGWApiMeta, AGWStageMeta, AGWResourceMeta } from "../types.js";

interface AwsRestApiDetail {
  id: string;
  name: string;
  description?: string;
  createdDate?: string;
  endpointConfiguration?: { types: string[] };
}

interface AwsStageDetail {
  stageName: string;
  description?: string;
  deploymentId?: string;
  lastUpdatedDate?: string;
  cacheClusterEnabled?: boolean;
  defaultRouteSettings?: {
    throttlingBurstLimit?: number;
    throttlingRateLimit?: number;
  };
  methodSettings?: Record<string, {
    throttlingBurstLimit?: number;
    throttlingRateLimit?: number;
  }>;
}

export function createApiGatewayDetailCapability(
  region?: string,
  getLevel?: () => ApiGatewayLevel,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);
  const r = resolveRegion(region);

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as ApiGatewayRowMeta | undefined;
    if (!meta) return [];
    const level = getLevel?.();

    if (level?.kind === "apis" && meta.type === "api") {
      const apiMeta = meta as AGWApiMeta;
      try {
        const data = await runAwsJsonAsync<AwsRestApiDetail>([
          "apigateway",
          "get-rest-api",
          "--rest-api-id",
          apiMeta.apiId,
          ...regionArgs,
        ]);
        const created = data.createdDate
          ? new Date(data.createdDate).toISOString().slice(0, 10)
          : "-";
        const endpointType = data.endpointConfiguration?.types?.[0] ?? "-";
        return [
          { label: "API Name", value: data.name },
          { label: "API ID", value: data.id },
          { label: "Description", value: data.description || "-" },
          { label: "Endpoint Type", value: endpointType },
          { label: "Created Date", value: created },
        ];
      } catch (e) {
        debugLog("apigateway", "getDetails (api) failed", e);
        return [];
      }
    }

    if (level?.kind === "stages" && meta.type === "stage") {
      const stageMeta = meta as AGWStageMeta;
      try {
        const data = await runAwsJsonAsync<AwsStageDetail>([
          "apigateway",
          "get-stage",
          "--rest-api-id",
          stageMeta.apiId,
          "--stage-name",
          stageMeta.stageName,
          ...regionArgs,
        ]);
        const lastUpdated = data.lastUpdatedDate
          ? new Date(data.lastUpdatedDate).toISOString().slice(0, 19).replace("T", " ")
          : "-";
        const invokeUrl = `https://${stageMeta.apiId}.execute-api.${r}.amazonaws.com/${stageMeta.stageName}`;

        const burstLimit = data.defaultRouteSettings?.throttlingBurstLimit;
        const rateLimit = data.defaultRouteSettings?.throttlingRateLimit;

        return [
          { label: "Stage Name", value: data.stageName },
          { label: "API", value: stageMeta.apiName },
          { label: "Invoke URL", value: invokeUrl },
          { label: "Deployment ID", value: data.deploymentId ?? "-" },
          { label: "Description", value: data.description || "-" },
          { label: "Caching Enabled", value: data.cacheClusterEnabled ? "Yes" : "No" },
          { label: "Default Throttle Burst", value: burstLimit != null ? String(burstLimit) : "-" },
          { label: "Default Throttle Rate", value: rateLimit != null ? String(rateLimit) : "-" },
          { label: "Last Updated", value: lastUpdated },
        ];
      } catch (e) {
        debugLog("apigateway", "getDetails (stage) failed", e);
        return [];
      }
    }

    if (level?.kind === "resources" && meta.type === "resource") {
      const resMeta = meta as AGWResourceMeta;
      const methods = row.cells.methods?.displayName ?? "-";
      return [
        { label: "Path", value: resMeta.resourcePath },
        { label: "Resource ID", value: resMeta.resourceId },
        { label: "API", value: resMeta.apiName },
        { label: "Stage", value: resMeta.stageName },
        { label: "Methods", value: methods },
      ];
    }

    return [];
  };

  return { getDetails };
}
