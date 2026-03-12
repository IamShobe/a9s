import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import { statusCell } from "../../utils/statusColors.js";
import { runAwsJsonAsync, buildRegionArgs, resolveRegion } from "../../utils/aws.js";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { atom, getDefaultStore } from "jotai";
import type { AwsCloudFormationStack, AwsCloudFormationStackResource, CloudFormationLevel, CloudFormationRowMeta } from "./types.js";
import { createCloudFormationDetailCapability } from "./capabilities/detailCapability.js";
import { createCloudFormationYankCapability } from "./capabilities/yankCapability.js";
import { createCloudFormationActionCapability } from "./capabilities/actionCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";

interface CloudFormationNavFrame extends NavFrame {
  level: CloudFormationLevel;
}

export const cloudformationLevelAtom = atom<CloudFormationLevel>({ kind: "stacks" });
export const cloudformationBackStackAtom = atom<CloudFormationNavFrame[]>([]);

export function createCloudFormationServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const store = getDefaultStore();
  const regionArgs = buildRegionArgs(region);

  const getLevel = () => store.get(cloudformationLevelAtom);
  const setLevel = (level: CloudFormationLevel) => store.set(cloudformationLevelAtom, level);
  const getBackStack = () => store.get(cloudformationBackStackAtom);
  const setBackStack = (stack: CloudFormationNavFrame[]) => store.set(cloudformationBackStackAtom, stack);

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "stacks") {
      return [
        { key: "name", label: "Name", width: 32 },
        { key: "status", label: "Status", width: 26 },
        { key: "created", label: "Created", width: 22 },
        { key: "updated", label: "Updated", width: 22 },
        { key: "description", label: "Description" },
      ];
    }
    // resources level
    return [
      { key: "logicalId", label: "Logical ID", width: 32 },
      { key: "physicalId", label: "Physical ID", width: 40 },
      { key: "type", label: "Type", width: 32 },
      { key: "status", label: "Status" },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "stacks") {
      try {
        const data = await runAwsJsonAsync<{ Stacks: AwsCloudFormationStack[] }>([
          "cloudformation",
          "describe-stacks",
          ...regionArgs,
        ]);

        return (data.Stacks ?? []).map((stack) => ({
          id: stack.StackId ?? stack.StackName,
          cells: {
            name: textCell(stack.StackName),
            status: statusCell(stack.StackStatus ?? "-"),
            created: textCell(stack.CreationTime ? stack.CreationTime.slice(0, 19).replace("T", " ") : "-"),
            updated: textCell(stack.LastUpdatedTime ? stack.LastUpdatedTime.slice(0, 19).replace("T", " ") : "-"),
            description: textCell(stack.Description ?? "-"),
          },
          meta: {
            type: "stack",
            stackName: stack.StackName,
            stackId: stack.StackId ?? "",
            stackStatus: stack.StackStatus ?? "",
            creationTime: stack.CreationTime ?? "",
          } satisfies CloudFormationRowMeta,
        }));
      } catch (e) {
        debugLog("cloudformation", "getRows (stacks) failed", e);
        return [];
      }
    }

    // resources level
    const { stackName } = level;
    try {
      const data = await runAwsJsonAsync<{ StackResourceSummaries: AwsCloudFormationStackResource[] }>([
        "cloudformation",
        "list-stack-resources",
        "--stack-name",
        stackName,
        ...regionArgs,
      ]);

      return (data.StackResourceSummaries ?? []).map((res) => ({
        id: res.LogicalResourceId,
        cells: {
          logicalId: textCell(res.LogicalResourceId),
          physicalId: textCell(res.PhysicalResourceId ?? "-"),
          type: textCell(res.ResourceType ?? "-"),
          status: statusCell(res.ResourceStatus ?? "-"),
        },
        meta: {
          type: "resource",
          logicalResourceId: res.LogicalResourceId,
          physicalResourceId: res.PhysicalResourceId ?? "",
          resourceType: res.ResourceType ?? "",
          resourceStatus: res.ResourceStatus ?? "",
          stackName,
        } satisfies CloudFormationRowMeta,
      }));
    } catch (e) {
      debugLog("cloudformation", `getRows (resources for ${stackName}) failed`, e);
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as CloudFormationRowMeta | undefined;

    if (level.kind === "stacks") {
      if (!meta || meta.type !== "stack") return { action: "none" };

      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({ kind: "resources", stackName: meta.stackName, stackId: meta.stackId });
      return { action: "navigate" };
    }

    // resources level: leaf
    return { action: "none" };
  };

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "stacks") return "cfn://";
    return `cfn://${level.stackName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "stacks") return "📦 CloudFormation Stacks";
    return `📦 ${level.stackName}`;
  };

  const detailCapability = createCloudFormationDetailCapability(region, getLevel);
  const yankCapability = createCloudFormationYankCapability();
  const actionCapability = createCloudFormationActionCapability(region, getLevel);

  const getBrowserUrl = (row: TableRow): string | null => {
    const r = resolveRegion(region);
    const meta = row.meta as CloudFormationRowMeta | undefined;
    if (!meta) return null;
    if (meta.type === "stack") {
      return `https://${r}.console.aws.amazon.com/cloudformation/home?region=${r}#/stacks/stackinfo?stackId=${encodeURIComponent(meta.stackId)}`;
    }
    return null;
  };

  return {
    id: "cloudformation",
    label: "CloudFormation",
    hudColor: SERVICE_COLORS.cloudformation ?? { bg: "yellow", fg: "black" },
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    getBrowserUrl,
    reset() {
      setLevel({ kind: "stacks" });
      setBackStack([]);
    },
    capabilities: {
      detail: detailCapability,
      yank: yankCapability,
      actions: actionCapability,
    },
  };
}
