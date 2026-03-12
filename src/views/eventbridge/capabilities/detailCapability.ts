import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs, resolveRegion } from "../../../utils/aws.js";
import { debugLog } from "../../../utils/debugLogger.js";
import type { EventBridgeLevel, EventBridgeRowMeta, EBBusMeta, EBRuleMeta } from "../types.js";

interface AwsDescribeEventBus {
  Name: string;
  Arn: string;
  Policy?: string;
}

interface AwsDescribeRule {
  Name: string;
  Arn: string;
  State?: string;
  EventBusName?: string;
  ScheduleExpression?: string;
  EventPattern?: string;
  Description?: string;
}

interface AwsListTargetsResponse {
  Targets: { Id: string }[];
}

export function createEventBridgeDetailCapability(
  region?: string,
  getLevel?: () => EventBridgeLevel,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);
  const r = resolveRegion(region);
  void r;

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as EventBridgeRowMeta | undefined;
    if (!meta) return [];
    const level = getLevel?.();

    if (level?.kind === "buses" && meta.type === "bus") {
      const busMeta = meta as EBBusMeta;
      try {
        const data = await runAwsJsonAsync<AwsDescribeEventBus>([
          "events",
          "describe-event-bus",
          "--name",
          busMeta.busName,
          ...regionArgs,
        ]);
        const createdBy = data.Arn?.split(":")?.[4] ?? "-";
        return [
          { label: "Name", value: data.Name },
          { label: "ARN", value: data.Arn },
          { label: "Policy", value: data.Policy ? "Yes" : "No" },
          { label: "Created By (Account)", value: createdBy },
        ];
      } catch (e) {
        debugLog("eventbridge", "getDetails (bus) failed", e);
        return [];
      }
    }

    if (level?.kind === "rules" && meta.type === "rule") {
      const ruleMeta = meta as EBRuleMeta;
      try {
        const [ruleData, targetsData] = await Promise.all([
          runAwsJsonAsync<AwsDescribeRule>([
            "events",
            "describe-rule",
            "--name",
            ruleMeta.ruleName,
            "--event-bus-name",
            ruleMeta.busName,
            ...regionArgs,
          ]),
          runAwsJsonAsync<AwsListTargetsResponse>([
            "events",
            "list-targets-by-rule",
            "--rule",
            ruleMeta.ruleName,
            "--event-bus-name",
            ruleMeta.busName,
            ...regionArgs,
          ]),
        ]);

        const fields: DetailField[] = [
          { label: "Rule Name", value: ruleData.Name },
          { label: "ARN", value: ruleData.Arn },
          { label: "State", value: ruleData.State ?? "-" },
          { label: "Event Bus", value: ruleData.EventBusName ?? ruleMeta.busName },
        ];

        if (ruleData.ScheduleExpression) {
          fields.push({ label: "Schedule Expression", value: ruleData.ScheduleExpression });
        }

        if (ruleData.EventPattern) {
          try {
            const pretty = JSON.stringify(JSON.parse(ruleData.EventPattern), null, 2);
            fields.push({ label: "Event Pattern", value: pretty });
          } catch {
            fields.push({ label: "Event Pattern", value: ruleData.EventPattern });
          }
        }

        fields.push({ label: "Description", value: ruleData.Description || "-" });
        fields.push({ label: "Target Count", value: String(targetsData.Targets?.length ?? 0) });

        const createdBy = ruleData.Arn?.split(":")?.[4] ?? "-";
        fields.push({ label: "Created By (Account)", value: createdBy });

        return fields;
      } catch (e) {
        debugLog("eventbridge", "getDetails (rule) failed", e);
        return [];
      }
    }

    return [];
  };

  return { getDetails };
}
