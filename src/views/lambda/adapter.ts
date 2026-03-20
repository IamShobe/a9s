import type { ServiceAdapter, RelatedResource } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import type { BookmarkKeyPart } from "../../utils/bookmarks.js";
import { runAwsJsonAsync, buildRegionArgs, resolveRegion } from "../../utils/aws.js";
import { createStackState } from "../../utils/createStackState.js";
import type { AwsLambdaFunction, AwsLambdaVersion, LambdaLevel, LambdaRowMeta } from "./types.js";
import { createLambdaDetailCapability } from "./capabilities/detailCapability.js";
import { createLambdaYankCapability } from "./capabilities/yankCapability.js";
import { createLambdaEditCapability } from "./capabilities/editCapability.js";
import { createLambdaActionCapability } from "./capabilities/actionCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";
import { ageBandProps } from "../../utils/ageBanding.js";

interface LambdaNavFrame extends NavFrame {
  level: LambdaLevel;
}


function formatLastModified(raw?: string): string {
  if (!raw) return "-";
  // Lambda returns ISO 8601 with milliseconds: "2024-01-15T10:23:45.000+0000"
  return raw.slice(0, 19).replace("T", " ");
}

export function createLambdaServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const regionArgs = buildRegionArgs(region);
  const { getLevel, setLevel, getBackStack, setBackStack, canGoBack, goBack, pushUiLevel, reset } = createStackState<LambdaLevel, LambdaNavFrame>({ kind: "functions" });

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "functions") {
      return [
        { key: "name", label: "Name" },
        { key: "runtime", label: "Runtime", width: 15 },
        { key: "memory", label: "Memory", width: 10, heatmap: { type: "numeric" } },
        { key: "timeout", label: "Timeout", width: 10, heatmap: { type: "numeric" } },
        { key: "lastModified", label: "Last Modified", width: 22, heatmap: { type: "date" } },
      ];
    }
    // versions level
    return [
      { key: "version", label: "Version", width: 12 },
      { key: "description", label: "Description" },
      { key: "codeSize", label: "Code Size", width: 12, heatmap: { type: "numeric" } },
      { key: "lastModified", label: "Last Modified", width: 22, heatmap: { type: "date" } },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "functions") {
      try {
        const data = await runAwsJsonAsync<{ Functions: AwsLambdaFunction[] }>([
          "lambda",
          "list-functions",
          ...regionArgs,
        ]);

        return (data.Functions ?? []).map((fn) => ({
          id: fn.FunctionArn,
          cells: {
            name: textCell(fn.FunctionName),
            runtime: textCell(fn.Runtime ?? "-"),
            memory: textCell(fn.MemorySize != null ? `${fn.MemorySize} MB` : "-"),
            timeout: textCell(fn.Timeout != null ? `${fn.Timeout}s` : "-"),
            lastModified: textCell(formatLastModified(fn.LastModified)),
          },
          meta: {
            type: "function",
            functionName: fn.FunctionName,
            functionArn: fn.FunctionArn,
            runtime: fn.Runtime ?? "",
          } satisfies LambdaRowMeta,
          ...ageBandProps(fn.LastModified),
        }));
      } catch (e) {
        debugLog("lambda", "getRows (functions) failed", e);
        return [];
      }
    }

    // versions level
    const { functionName, functionArn } = level;
    try {
      const data = await runAwsJsonAsync<{ Versions: AwsLambdaVersion[] }>([
        "lambda",
        "list-versions-by-function",
        "--function-name",
        functionName,
        ...regionArgs,
      ]);

      return (data.Versions ?? []).map((ver) => ({
        id: `${functionArn}:${ver.Version}`,
        cells: {
          version: textCell(ver.Version),
          description: textCell(ver.Description || "-"),
          codeSize: textCell(ver.CodeSize != null ? `${Math.round(ver.CodeSize / 1024)} KB` : "-"),
          lastModified: textCell(formatLastModified(ver.LastModified)),
        },
        meta: {
          type: "version",
          functionName: ver.FunctionName,
          functionArn: ver.FunctionArn,
          version: ver.Version,
        } satisfies LambdaRowMeta,
      }));
    } catch (e) {
      debugLog("lambda", "getRows (versions) failed", e);
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as LambdaRowMeta | undefined;

    if (level.kind === "functions") {
      if (!meta || meta.type !== "function") return { action: "none" };

      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "versions",
        functionName: meta.functionName,
        functionArn: meta.functionArn,
      });
      return { action: "navigate" };
    }

    // versions level: leaf
    return { action: "none" };
  };

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "functions") return "lambda://";
    return `lambda://${level.functionName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "functions") return "λ Functions";
    return `λ ${level.functionName}`;
  };

  const detailCapability = createLambdaDetailCapability(region, getLevel);
  const yankCapability = createLambdaYankCapability();
  const editCapability = createLambdaEditCapability(region, getLevel);
  const actionCapability = createLambdaActionCapability(region, getLevel);

  const getRelatedResources = (row: TableRow): RelatedResource[] => {
    const meta = row.meta as LambdaRowMeta | undefined;
    if (!meta) return [];
    const functionName = meta.functionName;
    return [
      {
        serviceId: "cloudwatch",
        label: `CloudWatch logs for ${functionName}`,
        filterHint: `/aws/lambda/${functionName}`,
      },
    ];
  };

  const getBrowserUrl = (row: TableRow): string | null => {
    const r = resolveRegion(region);
    const meta = row.meta as LambdaRowMeta | undefined;
    if (!meta) return null;
    if (meta.type === "function") {
      return `https://${r}.console.aws.amazon.com/lambda/home?region=${r}#/functions/${meta.functionName}`;
    }
    if (meta.type === "version") {
      return `https://${r}.console.aws.amazon.com/lambda/home?region=${r}#/functions/${meta.functionName}/versions/${meta.version}`;
    }
    return null;
  };

  return {
    id: "lambda",
    label: "Lambda",
    hudColor: SERVICE_COLORS.lambda ?? { bg: "green", fg: "black" },
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    pushUiLevel,
    getPath,
    getContextLabel,
    getRelatedResources,
    getBrowserUrl,
    reset,
    getBookmarkKey(row: TableRow): BookmarkKeyPart[] {
      const level = getLevel();
      const meta = row.meta as LambdaRowMeta | undefined;
      if (level.kind === "functions") {
        const functionName = meta?.type === "function" ? meta.functionName : row.id;
        return [{ label: "Function", displayName: functionName, id: row.id }];
      }
      // versions level
      const version = meta?.type === "version" ? meta.version : row.id;
      return [
        { label: "Function", displayName: level.functionName, id: level.functionArn },
        { label: "Version", displayName: version, id: row.id },
      ];
    },
    restoreFromKey(key: BookmarkKeyPart[]): void {
      if (key.length === 1) {
        setBackStack([]);
        setLevel({ kind: "functions" });
      } else if (key.length >= 2) {
        const functionName = key[0]!.displayName;
        const functionArn = key[0]!.id ?? key[0]!.displayName;
        setBackStack([{ level: { kind: "functions" }, selectedIndex: 0 }]);
        setLevel({ kind: "versions", functionName, functionArn });
      }
    },
    capabilities: {
      detail: detailCapability,
      yank: yankCapability,
      edit: editCapability,
      actions: actionCapability,
    },
  };
}
