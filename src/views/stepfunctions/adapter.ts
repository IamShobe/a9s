import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import { statusCell } from "../../utils/statusColors.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../utils/aws.js";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { atom, getDefaultStore } from "jotai";
import type { AwsSFNStateMachine, AwsSFNExecution, StepFunctionsLevel, SFNRowMeta } from "./types.js";
import { createSFNDetailCapability } from "./capabilities/detailCapability.js";
import { createSFNYankCapability } from "./capabilities/yankCapability.js";
import { createSFNActionCapability } from "./capabilities/actionCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";

interface SFNNavFrame extends NavFrame {
  level: StepFunctionsLevel;
}

export const sfnLevelAtom = atom<StepFunctionsLevel>({ kind: "state-machines" });
export const sfnBackStackAtom = atom<SFNNavFrame[]>([]);

function formatDuration(startDate?: string, stopDate?: string): string {
  if (!startDate) return "-";
  const start = new Date(startDate).getTime();
  const end = stopDate ? new Date(stopDate).getTime() : Date.now();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h`;
}

export function createStepFunctionsServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const store = getDefaultStore();
  const regionArgs = buildRegionArgs(region);

  const getLevel = () => store.get(sfnLevelAtom);
  const setLevel = (level: StepFunctionsLevel) => store.set(sfnLevelAtom, level);
  const getBackStack = () => store.get(sfnBackStackAtom);
  const setBackStack = (stack: SFNNavFrame[]) => store.set(sfnBackStackAtom, stack);

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "state-machines") {
      return [
        { key: "name", label: "Name" },
        { key: "type", label: "Type", width: 10 },
        { key: "created", label: "Created", width: 12 },
      ];
    }
    // executions level
    return [
      { key: "name", label: "Execution Name" },
      { key: "status", label: "Status", width: 12 },
      { key: "started", label: "Started", width: 20 },
      { key: "duration", label: "Duration", width: 10 },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "state-machines") {
      try {
        const data = await runAwsJsonAsync<{ stateMachines: AwsSFNStateMachine[] }>([
          "stepfunctions",
          "list-state-machines",
          ...regionArgs,
        ]);
        return (data.stateMachines ?? []).map((sm) => ({
          id: sm.stateMachineArn,
          cells: {
            name: textCell(sm.name),
            type: textCell(sm.type ?? "STANDARD"),
            created: textCell(sm.creationDate ? sm.creationDate.slice(0, 10) : "-"),
          },
          meta: {
            type: "state-machine",
            stateMachineArn: sm.stateMachineArn,
            stateMachineName: sm.name,
            stateMachineType: sm.type ?? "STANDARD",
          } satisfies SFNRowMeta,
        }));
      } catch (e) {
        debugLog("stepfunctions", "getRows (state-machines) failed", e);
        return [];
      }
    }

    // executions level
    const { stateMachineArn, stateMachineName } = level;
    try {
      const data = await runAwsJsonAsync<{ executions: AwsSFNExecution[] }>([
        "stepfunctions",
        "list-executions",
        "--state-machine-arn",
        stateMachineArn,
        "--max-results",
        "100",
        ...regionArgs,
      ]);
      return (data.executions ?? []).map((exec) => ({
        id: exec.executionArn,
        cells: {
          name: textCell(exec.name),
          status: statusCell(exec.status),
          started: textCell(exec.startDate ? exec.startDate.slice(0, 19).replace("T", " ") : "-"),
          duration: textCell(formatDuration(exec.startDate, exec.stopDate)),
        },
        meta: {
          type: "execution",
          executionArn: exec.executionArn,
          stateMachineArn,
          stateMachineName,
          status: exec.status,
        } satisfies SFNRowMeta,
      }));
    } catch (e) {
      debugLog("stepfunctions", `getRows (executions for ${stateMachineName}) failed`, e);
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as SFNRowMeta | undefined;

    if (level.kind === "state-machines") {
      if (!meta || meta.type !== "state-machine") return { action: "none" };
      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "executions",
        stateMachineArn: meta.stateMachineArn,
        stateMachineName: meta.stateMachineName,
      });
      return { action: "navigate" };
    }

    // executions level: leaf
    return { action: "none" };
  };

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "state-machines") return "sfn://";
    return `sfn://${level.stateMachineName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "state-machines") return "⚙ Step Functions";
    return `⚙ ${level.stateMachineName}`;
  };

  const detailCapability = createSFNDetailCapability(region, getLevel);
  const yankCapability = createSFNYankCapability();
  const actionCapability = createSFNActionCapability(region, getLevel);

  const getBrowserUrl = (row: TableRow): string | null => {
    const r = region ?? "us-east-1";
    const meta = row.meta as SFNRowMeta | undefined;
    if (!meta) return null;
    if (meta.type === "state-machine") {
      return `https://${r}.console.aws.amazon.com/states/home?region=${r}#/statemachines/view/${encodeURIComponent(meta.stateMachineArn)}`;
    }
    if (meta.type === "execution") {
      return `https://${r}.console.aws.amazon.com/states/home?region=${r}#/executions/details/${encodeURIComponent(meta.executionArn)}`;
    }
    return null;
  };

  return {
    id: "stepfunctions",
    label: "Step Functions",
    hudColor: SERVICE_COLORS.stepfunctions ?? { bg: "magenta", fg: "white" },
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    getBrowserUrl,
    reset() {
      setLevel({ kind: "state-machines" });
      setBackStack([]);
    },
    capabilities: {
      detail: detailCapability,
      yank: yankCapability,
      actions: actionCapability,
    },
  };
}
