import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult } from "../../types.js";
import { textCell } from "../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../utils/aws.js";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { atom, getDefaultStore } from "jotai";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";
import type {
  ApiGatewayLevel,
  ApiGatewayNavFrame,
  ApiGatewayRowMeta,
  AGWStageMeta,
  AwsRestApi,
  AwsStage,
  AwsResource,
} from "./types.js";
import type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "../../adapters/capabilities/ActionCapability.js";

export const apiGatewayLevelAtom = atom<ApiGatewayLevel>({ kind: "apis" });
export const apiGatewayBackStackAtom = atom<ApiGatewayNavFrame[]>([]);

export function createApiGatewayServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const store = getDefaultStore();
  const regionArgs = buildRegionArgs(region);
  const r = region ?? "us-east-1";

  const getLevel = () => store.get(apiGatewayLevelAtom);
  const setLevel = (level: ApiGatewayLevel) => store.set(apiGatewayLevelAtom, level);
  const getBackStack = () => store.get(apiGatewayBackStackAtom);
  const setBackStack = (stack: ApiGatewayNavFrame[]) =>
    store.set(apiGatewayBackStackAtom, stack);

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "apis") {
      return [
        { key: "name", label: "API Name" },
        { key: "id", label: "ID", width: 12 },
        { key: "protocol", label: "Protocol", width: 8 },
        { key: "endpoint", label: "Endpoint Type", width: 14 },
        { key: "created", label: "Created", width: 12 },
      ];
    }
    if (level.kind === "stages") {
      return [
        { key: "name", label: "Stage" },
        { key: "invokeUrl", label: "Invoke URL" },
        { key: "deployment", label: "Deployment ID", width: 16 },
      ];
    }
    // resources level
    return [
      { key: "path", label: "Path" },
      { key: "methods", label: "Methods", width: 30 },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "apis") {
      try {
        const data = await runAwsJsonAsync<{ items: AwsRestApi[] }>([
          "apigateway",
          "get-rest-apis",
          "--limit",
          "100",
          ...regionArgs,
        ]);
        return (data.items ?? []).map((api) => {
          const endpointType = api.endpointConfiguration?.types?.[0] ?? "-";
          const created = api.createdDate
            ? new Date(api.createdDate).toISOString().slice(0, 10)
            : "-";
          return {
            id: api.id,
            cells: {
              name: textCell(api.name),
              id: textCell(api.id),
              protocol: textCell("REST"),
              endpoint: textCell(endpointType),
              created: textCell(created),
            },
            meta: {
              type: "api",
              apiId: api.id,
              apiName: api.name,
              protocol: "REST",
            } satisfies ApiGatewayRowMeta,
          };
        });
      } catch (e) {
        debugLog("apigateway", "getRows (apis) failed", e);
        return [];
      }
    }

    if (level.kind === "stages") {
      try {
        const data = await runAwsJsonAsync<{ item: AwsStage[] }>([
          "apigateway",
          "get-stages",
          "--rest-api-id",
          level.apiId,
          ...regionArgs,
        ]);
        return (data.item ?? []).map((stage) => {
          const invokeUrl = `https://${level.apiId}.execute-api.${r}.amazonaws.com/${stage.stageName}`;
          return {
            id: `${level.apiId}/${stage.stageName}`,
            cells: {
              name: textCell(stage.stageName),
              invokeUrl: textCell(invokeUrl),
              deployment: textCell(stage.deploymentId ?? "-"),
            },
            meta: {
              type: "stage",
              apiId: level.apiId,
              apiName: level.apiName,
              stageName: stage.stageName,
              invokeUrl,
            } satisfies ApiGatewayRowMeta,
          };
        });
      } catch (e) {
        debugLog("apigateway", "getRows (stages) failed", e);
        return [];
      }
    }

    if (level.kind === "resources") {
      try {
        const data = await runAwsJsonAsync<{ items: AwsResource[] }>([
          "apigateway",
          "get-resources",
          "--rest-api-id",
          level.apiId,
          "--limit",
          "500",
          ...regionArgs,
        ]);
        return (data.items ?? [])
          .sort((a, b) => a.path.localeCompare(b.path))
          .map((res) => {
            const methods = res.resourceMethods
              ? Object.keys(res.resourceMethods).join(", ")
              : "-";
            return {
              id: res.id,
              cells: {
                path: textCell(res.path),
                methods: textCell(methods),
              },
              meta: {
                type: "resource",
                apiId: level.apiId,
                apiName: level.apiName,
                stageName: level.stageName,
                resourceId: res.id,
                resourcePath: res.path,
              } satisfies ApiGatewayRowMeta,
            };
          });
      } catch (e) {
        debugLog("apigateway", "getRows (resources) failed", e);
        return [];
      }
    }

    return [];
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const meta = row.meta as ApiGatewayRowMeta | undefined;

    if (level.kind === "apis" && meta?.type === "api") {
      const backStack = getBackStack();
      setBackStack([...backStack, { level, selectedIndex: 0 } as ApiGatewayNavFrame]);
      setLevel({ kind: "stages", apiId: meta.apiId, apiName: meta.apiName });
      return { action: "navigate" };
    }

    if (level.kind === "stages" && meta?.type === "stage") {
      const backStack = getBackStack();
      setBackStack([...backStack, { level, selectedIndex: 0 } as ApiGatewayNavFrame]);
      setLevel({ kind: "resources", apiId: meta.apiId, apiName: meta.apiName, stageName: meta.stageName });
      return { action: "navigate" };
    }

    return { action: "none" };
  };

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "apis") return "apigateway://";
    if (level.kind === "stages") return `apigateway://${level.apiName}`;
    return `apigateway://${level.apiName}/${level.stageName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "apis") return "🌐 REST APIs";
    if (level.kind === "stages") return `🌐 ${level.apiName} / Stages`;
    return `🌐 ${level.apiName} / ${level.stageName} / Resources`;
  };

  const actionsCapability: ActionCapability = {
    getKeybindings(): AdapterKeyBinding[] {
      return [
        {
          trigger: { type: "key", char: "u" },
          actionId: "copy-invoke-url",
          label: "Copy invoke URL",
          shortLabel: "copy-url",
          scope: "navigate",
          adapterId: "apigateway",
        },
      ];
    },

    async executeAction(actionId: string, context: ActionContext): Promise<ActionEffect> {
      const meta = context.row?.meta as ApiGatewayRowMeta | undefined;

      if (actionId === "copy-invoke-url") {
        if (!meta || meta.type !== "stage") {
          return { type: "feedback", message: "Select a stage to copy its invoke URL" };
        }
        const stageMeta = meta as AGWStageMeta;
        const { default: clipboardy } = await import("clipboardy");
        await clipboardy.write(stageMeta.invokeUrl);
        return { type: "feedback", message: `Copied: ${stageMeta.invokeUrl}` };
      }

      return { type: "none" };
    },
  };

  return {
    id: "apigateway",
    label: "API Gateway",
    hudColor: SERVICE_COLORS.apigateway ?? { bg: "magenta", fg: "white" },
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    reset() {
      setLevel({ kind: "apis" });
      setBackStack([]);
    },
    getBrowserUrl(row) {
      const meta = row.meta as ApiGatewayRowMeta | undefined;
      if (!meta) return null;
      if (meta.type === "api") {
        return `https://${r}.console.aws.amazon.com/apigateway/home?region=${r}#/apis/${meta.apiId}/resources`;
      }
      if (meta.type === "stage") {
        return `https://${r}.console.aws.amazon.com/apigateway/home?region=${r}#/apis/${meta.apiId}/stages/${encodeURIComponent(meta.stageName)}`;
      }
      return null;
    },
    capabilities: {
      actions: actionsCapability,
    },
  };
}
