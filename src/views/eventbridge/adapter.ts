import type { ServiceAdapter, RelatedResource } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import { singlePartKey } from "../../utils/bookmarks.js";
import { runAwsJsonAsync, buildRegionArgs, resolveRegion } from "../../utils/aws.js";
import { createStackState } from "../../utils/createStackState.js";
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
import { createEventBridgeDetailCapability } from "./capabilities/detailCapability.js";
import { createEventBridgeYankCapability } from "./capabilities/yankCapability.js";


export function createEventBridgeServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const regionArgs = buildRegionArgs(region);
  const r = resolveRegion(region);
  const { getLevel, setLevel, getBackStack, setBackStack, canGoBack, goBack, pushUiLevel, reset } = createStackState<EventBridgeLevel, EventBridgeNavFrame>({ kind: "buses" });

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

  const detailCapability = createEventBridgeDetailCapability(region, getLevel);
  const yankCapability = createEventBridgeYankCapability();

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

  function targetToRelated(targetArn: string): RelatedResource | null {
    if (targetArn.includes(":function:")) {
      const name = targetArn.split(":function:")[1] ?? "";
      return { serviceId: "lambda", label: `Lambda: ${name}`, filterHint: name };
    }
    if (targetArn.match(/arn:aws:sqs:/)) {
      const name = targetArn.split(":").pop() ?? "";
      return { serviceId: "sqs", label: `SQS: ${name}`, filterHint: name };
    }
    if (targetArn.includes(":sns:")) {
      const name = targetArn.split(":").pop() ?? "";
      return { serviceId: "sns", label: `SNS: ${name}`, filterHint: name };
    }
    if (targetArn.includes(":log-group:")) {
      const name = targetArn.split(":log-group:")[1] ?? "";
      return { serviceId: "cloudwatch", label: `CloudWatch: ${name}`, filterHint: name };
    }
    return null;
  }

  const getRelatedResources = async (row: TableRow): Promise<RelatedResource[]> => {
    const level = getLevel();
    if (level.kind !== "rules") return [];
    const meta = row.meta as EventBridgeRowMeta | undefined;
    if (!meta || meta.type !== "rule") return [];

    try {
      const data = await runAwsJsonAsync<{ Targets: Array<{ Id: string; Arn: string }> }>([
        "events",
        "list-targets-by-rule",
        "--rule",
        meta.ruleName,
        "--event-bus-name",
        meta.busName,
        ...regionArgs,
      ]);
      return (data.Targets ?? [])
        .map((t) => targetToRelated(t.Arn))
        .filter((r): r is RelatedResource => r !== null);
    } catch {
      return [];
    }
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
    pushUiLevel,
    getPath,
    getContextLabel,
    getRelatedResources,
    reset,
    getBookmarkKey(row: TableRow) {
      return singlePartKey("Rule", row);
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
      detail: detailCapability,
      yank: yankCapability,
    },
  };
}
