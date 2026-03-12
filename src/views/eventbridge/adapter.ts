import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import { runAwsJsonAsync, buildRegionArgs, resolveRegion } from "../../utils/aws.js";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { atom, getDefaultStore } from "jotai";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";
import { statusCell } from "../../utils/statusColors.js";
import type {
  EventBridgeLevel,
  EventBridgeNavFrame,
  EventBridgeRowMeta,
  EBRuleMeta,
  AwsEventBus,
  AwsEventRule,
} from "./types.js";
import type {
  ActionCapability,
  AdapterKeyBinding,
  ActionContext,
  ActionEffect,
} from "../../adapters/capabilities/ActionCapability.js";
import { toErrorMessage } from "../../utils/errorHelpers.js";

export const eventBridgeLevelAtom = atom<EventBridgeLevel>({ kind: "buses" });
export const eventBridgeBackStackAtom = atom<EventBridgeNavFrame[]>([]);

export function createEventBridgeServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const store = getDefaultStore();
  const regionArgs = buildRegionArgs(region);
  const r = resolveRegion(region);

  const getLevel = () => store.get(eventBridgeLevelAtom);
  const setLevel = (level: EventBridgeLevel) => store.set(eventBridgeLevelAtom, level);
  const getBackStack = () => store.get(eventBridgeBackStackAtom);
  const setBackStack = (stack: EventBridgeNavFrame[]) =>
    store.set(eventBridgeBackStackAtom, stack);

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "buses") {
      return [
        { key: "name", label: "Name" },
        { key: "hasPolicy", label: "Policy", width: 8 },
        { key: "arn", label: "ARN" },
      ];
    }
    return [
      { key: "name", label: "Rule Name" },
      { key: "state", label: "State", width: 12 },
      { key: "schedule", label: "Schedule / Pattern", width: 30 },
      { key: "description", label: "Description" },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "buses") {
      try {
        const data = await runAwsJsonAsync<{ EventBuses: AwsEventBus[] }>([
          "events",
          "list-event-buses",
          "--limit",
          "100",
          ...regionArgs,
        ]);
        return (data.EventBuses ?? []).map((bus) => ({
          id: bus.Arn,
          cells: {
            name: textCell(bus.Name),
            hasPolicy: textCell(bus.Policy ? "Yes" : "No"),
            arn: textCell(bus.Arn),
          },
          meta: {
            type: "bus",
            busName: bus.Name,
            busArn: bus.Arn,
          } satisfies EventBridgeRowMeta,
        }));
      } catch (e) {
        debugLog("eventbridge", "getRows (buses) failed", e);
        return [];
      }
    }

    // Rules level
    if (level.kind === "rules") {
      try {
        const data = await runAwsJsonAsync<{ Rules: AwsEventRule[] }>([
          "events",
          "list-rules",
          "--event-bus-name",
          level.busName,
          "--limit",
          "100",
          ...regionArgs,
        ]);

        return (data.Rules ?? []).map((rule) => {
            const scheduleOrPattern =
              rule.ScheduleExpression ??
              (rule.EventPattern ? rule.EventPattern.slice(0, 40) : "-");

            const ruleMeta: EBRuleMeta = {
              type: "rule",
              ruleName: rule.Name,
              ruleArn: rule.Arn,
              busName: level.busName,
              state: rule.State ?? "UNKNOWN",
            };
            if (rule.ScheduleExpression !== undefined) ruleMeta.schedule = rule.ScheduleExpression;
            if (rule.EventPattern !== undefined) ruleMeta.eventPattern = rule.EventPattern;

            return {
              id: rule.Arn,
              cells: {
                name: textCell(rule.Name),
                state: statusCell(rule.State ?? "UNKNOWN"),
                schedule: textCell(scheduleOrPattern),
                description: textCell(rule.Description || "-"),
              },
              meta: ruleMeta as EventBridgeRowMeta,
            };
          });
      } catch (e) {
        debugLog("eventbridge", "getRows (rules) failed", e);
        return [];
      }
    }

    return [];
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const meta = row.meta as EventBridgeRowMeta | undefined;

    if (level.kind === "buses" && meta?.type === "bus") {
      const backStack = getBackStack();
      setBackStack([...backStack, { level, selectedIndex: 0 } as EventBridgeNavFrame]);
      setLevel({ kind: "rules", busName: meta.busName });
      return { action: "navigate" };
    }

    return { action: "none" };
  };

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "buses") return "eventbridge://";
    return `eventbridge://${level.busName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "buses") return "⚡ Event Buses";
    return `⚡ ${level.busName} / Rules`;
  };

  const actionsCapability: ActionCapability = {
    getKeybindings(): AdapterKeyBinding[] {
      return [
        {
          trigger: { type: "key", char: "e" },
          actionId: "enable-rule",
          label: "Enable rule",
          shortLabel: "enable",
          scope: "navigate",
          adapterId: "eventbridge",
        },
        {
          trigger: { type: "key", char: "X" },
          actionId: "disable-rule",
          label: "Disable rule",
          shortLabel: "disable",
          scope: "navigate",
          adapterId: "eventbridge",
        },
        {
          trigger: { type: "key", char: "D" },
          actionId: "delete-rule",
          label: "Delete rule (confirm)",
          shortLabel: "delete",
          scope: "navigate",
          adapterId: "eventbridge",
        },
      ];
    },

    async executeAction(actionId: string, context: ActionContext): Promise<ActionEffect> {
      const meta = context.row?.meta as EventBridgeRowMeta | undefined;

      if (actionId === "enable-rule") {
        if (!meta || meta.type !== "rule") return { type: "none" };
        if (meta.state === "ENABLED") return { type: "feedback", message: "Rule is already enabled" };
        return {
          type: "confirm",
          message: `Enable rule "${meta.ruleName}"?`,
          nextActionId: "enable-rule:confirmed",
        };
      }

      if (actionId === "enable-rule:confirmed") {
        if (!meta || meta.type !== "rule") return { type: "none" };
        try {
          await runAwsJsonAsync([
            "events",
            "enable-rule",
            "--name",
            meta.ruleName,
            "--event-bus-name",
            meta.busName,
            ...regionArgs,
          ]);
          return {
            type: "multi",
            effects: [{ type: "feedback", message: `Enabled rule "${meta.ruleName}"` }, { type: "refresh" }],
          };
        } catch (err) {
          return { type: "error", message: toErrorMessage(err) };
        }
      }

      if (actionId === "disable-rule") {
        if (!meta || meta.type !== "rule") return { type: "none" };
        if (meta.state !== "ENABLED") return { type: "feedback", message: "Rule is not enabled" };
        return {
          type: "confirm",
          message: `Disable rule "${meta.ruleName}"?`,
          nextActionId: "disable-rule:confirmed",
        };
      }

      if (actionId === "disable-rule:confirmed") {
        if (!meta || meta.type !== "rule") return { type: "none" };
        try {
          await runAwsJsonAsync([
            "events",
            "disable-rule",
            "--name",
            meta.ruleName,
            "--event-bus-name",
            meta.busName,
            ...regionArgs,
          ]);
          return {
            type: "multi",
            effects: [{ type: "feedback", message: `Disabled rule "${meta.ruleName}"` }, { type: "refresh" }],
          };
        } catch (err) {
          return { type: "error", message: toErrorMessage(err) };
        }
      }

      if (actionId === "delete-rule") {
        if (!meta || meta.type !== "rule") return { type: "none" };
        return {
          type: "confirm",
          message: `Delete rule "${meta.ruleName}"? (targets must be removed first)`,
          nextActionId: "delete-rule:confirmed",
        };
      }

      if (actionId === "delete-rule:confirmed") {
        if (!meta || meta.type !== "rule") return { type: "none" };
        try {
          await runAwsJsonAsync([
            "events",
            "delete-rule",
            "--name",
            meta.ruleName,
            "--event-bus-name",
            meta.busName,
            ...regionArgs,
          ]);
          return {
            type: "multi",
            effects: [{ type: "feedback", message: `Deleted rule "${meta.ruleName}"` }, { type: "refresh" }],
          };
        } catch (err) {
          return { type: "error", message: toErrorMessage(err) };
        }
      }

      return { type: "none" };
    },
  };

  return {
    id: "eventbridge",
    label: "EventBridge",
    hudColor: SERVICE_COLORS.eventbridge ?? { bg: "yellow", fg: "black" },
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    reset() {
      setLevel({ kind: "buses" });
      setBackStack([]);
    },
    getBrowserUrl(row) {
      const meta = row.meta as EventBridgeRowMeta | undefined;
      if (!meta) return null;
      if (meta.type === "bus") {
        return `https://${r}.console.aws.amazon.com/events/home?region=${r}#/eventbuses`;
      }
      if (meta.type === "rule") {
        return `https://${r}.console.aws.amazon.com/events/home?region=${r}#/rules/${encodeURIComponent(meta.ruleName)}`;
      }
      return null;
    },
    capabilities: {
      actions: actionsCapability,
    },
  };
}
