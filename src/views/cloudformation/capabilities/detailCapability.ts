import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsCloudFormationStack, AwsCloudFormationStackResource, CloudFormationLevel, CloudFormationRowMeta } from "../types.js";
import { debugLog } from "../../../utils/debugLogger.js";

export function createCloudFormationDetailCapability(
  region?: string,
  getLevel?: () => CloudFormationLevel,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as CloudFormationRowMeta | undefined;
    if (!meta) return [];

    const level = getLevel?.();

    if (level?.kind === "stacks" && meta.type === "stack") {
      try {
        const data = await runAwsJsonAsync<{ Stacks: AwsCloudFormationStack[] }>([
          "cloudformation",
          "describe-stacks",
          "--stack-name",
          meta.stackName,
          ...regionArgs,
        ]);
        const stack = data.Stacks?.[0];
        if (!stack) return [];

        const fields: DetailField[] = [
          { label: "Name", value: stack.StackName },
          { label: "ID", value: stack.StackId ?? "-" },
          { label: "Status", value: stack.StackStatus ?? "-" },
          { label: "Created", value: stack.CreationTime ? stack.CreationTime.slice(0, 19).replace("T", " ") : "-" },
          { label: "Updated", value: stack.LastUpdatedTime ? stack.LastUpdatedTime.slice(0, 19).replace("T", " ") : "-" },
          { label: "Description", value: stack.Description ?? "(none)" },
          { label: "IAM Role", value: stack.RoleARN ?? "(default)" },
          { label: "Capabilities", value: stack.Capabilities?.join(", ") ?? "(none)" },
        ];

        if ((stack.Parameters ?? []).length > 0) {
          fields.push({
            label: "Parameters",
            value: (stack.Parameters ?? []).map((p) => `${p.ParameterKey}=${p.ParameterValue}`).join("\n"),
          });
        }

        if ((stack.Outputs ?? []).length > 0) {
          fields.push({
            label: "Outputs",
            value: (stack.Outputs ?? []).map((o) => `${o.OutputKey}=${o.OutputValue}`).join("\n"),
          });
        }

        if ((stack.Tags ?? []).length > 0) {
          fields.push({
            label: "Tags",
            value: (stack.Tags ?? []).map((t) => `${t.Key}=${t.Value}`).join("\n"),
          });
        }

        return fields;
      } catch (e) {
        debugLog("cloudformation", "getDetails (stack) failed", e);
        return [];
      }
    }

    if (level?.kind === "resources" && meta.type === "resource") {
      try {
        const data = await runAwsJsonAsync<{ StackResourceDetail: AwsCloudFormationStackResource }>([
          "cloudformation",
          "describe-stack-resource",
          "--stack-name",
          level.stackName,
          "--logical-resource-id",
          meta.logicalResourceId,
          ...regionArgs,
        ]);
        const res = data.StackResourceDetail;
        if (!res) return [];

        return [
          { label: "Logical ID", value: res.LogicalResourceId },
          { label: "Physical ID", value: res.PhysicalResourceId ?? "-" },
          { label: "Type", value: res.ResourceType ?? "-" },
          { label: "Status", value: res.ResourceStatus ?? "-" },
          { label: "Last Updated", value: res.LastUpdatedTimestamp ? res.LastUpdatedTimestamp.slice(0, 19).replace("T", " ") : "-" },
          { label: "Drift", value: res.DriftInformation?.StackResourceDriftStatus ?? "-" },
        ];
      } catch (e) {
        debugLog("cloudformation", "getDetails (resource) failed", e);
        return [];
      }
    }

    return [];
  };

  return { getDetails };
}
