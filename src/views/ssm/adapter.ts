import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import { runAwsJsonAsync, buildRegionArgs, resolveRegion } from "../../utils/aws.js";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { atom, getDefaultStore } from "jotai";
import type { AwsSSMParameter, AwsSSMParameterHistory, SSMLevel, SSMRowMeta } from "./types.js";
import { createSSMDetailCapability } from "./capabilities/detailCapability.js";
import { createSSMYankCapability } from "./capabilities/yankCapability.js";
import { createSSMEditCapability } from "./capabilities/editCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";

interface SSMNavFrame extends NavFrame {
  level: SSMLevel;
}

export const ssmLevelAtom = atom<SSMLevel>({ kind: "parameters" });
export const ssmBackStackAtom = atom<SSMNavFrame[]>([]);

function formatDate(raw?: string): string {
  if (!raw) return "-";
  return raw.slice(0, 19).replace("T", " ");
}

export function createSSMServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const store = getDefaultStore();
  const regionArgs = buildRegionArgs(region);

  const getLevel = () => store.get(ssmLevelAtom);
  const setLevel = (level: SSMLevel) => store.set(ssmLevelAtom, level);
  const getBackStack = () => store.get(ssmBackStackAtom);
  const setBackStack = (stack: SSMNavFrame[]) => store.set(ssmBackStackAtom, stack);

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "parameters") {
      return [
        { key: "name", label: "Name" },
        { key: "type", label: "Type", width: 14 },
        { key: "version", label: "Ver", width: 6 },
        { key: "lastModified", label: "Last Modified", width: 22 },
        { key: "description", label: "Description" },
      ];
    }
    // history level
    return [
      { key: "version", label: "Version", width: 10 },
      { key: "type", label: "Type", width: 14 },
      { key: "lastModified", label: "Last Modified", width: 22 },
      { key: "modifiedBy", label: "Modified By" },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "parameters") {
      try {
        // describe-parameters uses pagination; fetch first page
        const data = await runAwsJsonAsync<{ Parameters: AwsSSMParameter[] }>([
          "ssm",
          "describe-parameters",
          "--max-results",
          "50",
          ...regionArgs,
        ]);

        return (data.Parameters ?? []).map((p) => ({
          id: p.ARN ?? p.Name,
          cells: {
            name: textCell(p.Name),
            type: textCell(p.Type),
            version: textCell(p.Version != null ? String(p.Version) : "-"),
            lastModified: textCell(formatDate(p.LastModifiedDate)),
            description: textCell(p.Description || "-"),
          },
          meta: {
            type: "parameter",
            parameterName: p.Name,
            parameterType: p.Type,
            parameterArn: p.ARN ?? "",
          } satisfies SSMRowMeta,
        }));
      } catch (e) {
        debugLog("ssm", "getRows (parameters) failed", e);
        return [];
      }
    }

    // history level
    const { parameterName } = level;
    try {
      const data = await runAwsJsonAsync<{ Parameters: AwsSSMParameterHistory[] }>([
        "ssm",
        "get-parameter-history",
        "--name",
        parameterName,
        "--with-decryption",
        ...regionArgs,
      ]);

      return (data.Parameters ?? [])
        .sort((a, b) => b.Version - a.Version)
        .map((h) => ({
          id: `${parameterName}:${h.Version}`,
          cells: {
            version: textCell(String(h.Version)),
            type: textCell(h.Type),
            lastModified: textCell(formatDate(h.LastModifiedDate)),
            modifiedBy: textCell(h.LastModifiedUser ?? "-"),
          },
          meta: {
            type: "history",
            parameterName,
            version: h.Version,
            parameterType: h.Type,
          } satisfies SSMRowMeta,
        }));
    } catch (e) {
      debugLog("ssm", "getRows (history) failed", e);
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as SSMRowMeta | undefined;

    if (level.kind === "parameters") {
      if (!meta || meta.type !== "parameter") return { action: "none" };

      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({ kind: "history", parameterName: meta.parameterName });
      return { action: "navigate" };
    }

    // history level: leaf
    return { action: "none" };
  };

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "parameters") return "ssm://";
    return `ssm://${level.parameterName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "parameters") return "⚙️  SSM Parameters";
    return `⚙️  ${level.parameterName}`;
  };

  const detailCapability = createSSMDetailCapability(region, getLevel);
  const yankCapability = createSSMYankCapability(region);
  const editCapability = createSSMEditCapability(region, getLevel);

  const getBrowserUrl = (row: TableRow): string | null => {
    const r = resolveRegion(region);
    const meta = row.meta as SSMRowMeta | undefined;
    if (!meta) return null;
    if (meta.type === "parameter") {
      return `https://${r}.console.aws.amazon.com/systems-manager/parameters${meta.parameterName}/description?region=${r}`;
    }
    return null;
  };

  return {
    id: "ssm",
    label: "SSM",
    hudColor: SERVICE_COLORS.ssm ?? { bg: "cyan", fg: "black" },
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    getBrowserUrl,
    reset() {
      setLevel({ kind: "parameters" });
      setBackStack([]);
    },
    capabilities: {
      detail: detailCapability,
      yank: yankCapability,
      edit: editCapability,
    },
  };
}
