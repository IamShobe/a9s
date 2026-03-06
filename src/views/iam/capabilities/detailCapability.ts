import type {
  DetailCapability,
  DetailField,
} from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { getCellValue } from "../../../types.js";
import { runAwsJsonAsync } from "../../../utils/aws.js";
import { safeString, formatDate } from "../utils.js";
import type { IamLevel, IamRowMeta, AwsRole, AwsManagedPolicy } from "../types.js";

function getIamMeta(row: TableRow): IamRowMeta | undefined {
  return row.meta as IamRowMeta | undefined;
}

export function createIamDetailCapability(_getLevel: () => IamLevel): DetailCapability {
  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = getIamMeta(row);

    if (meta?.type === "role") {
      const roleName = meta.roleName;
      const data = await runAwsJsonAsync<{ Role: AwsRole }>([
        "iam",
        "get-role",
        "--role-name",
        roleName,
      ]);
      const role = data.Role;
      return [
        { label: "Name", value: role.RoleName },
        { label: "Type", value: "Role" },
        { label: "ARN", value: role.Arn },
        { label: "Path", value: role.Path ?? "/" },
        { label: "Created", value: formatDate(role.CreateDate) },
        {
          label: "Max Session Duration",
          value: role.MaxSessionDuration ? `${role.MaxSessionDuration} sec` : "-",
        },
        { label: "Description", value: role.Description ?? "-" },
        {
          label: "Last Used",
          value: formatDate(role.RoleLastUsed?.LastUsedDate),
        },
        {
          label: "Last Used Region",
          value: role.RoleLastUsed?.Region ?? "-",
        },
      ];
    }

    if (meta?.type === "inline-policy") {
      const { roleName, policyName } = meta;
      const data = await runAwsJsonAsync<{ PolicyDocument?: unknown }>([
        "iam",
        "get-role-policy",
        "--role-name",
        roleName,
        "--policy-name",
        policyName,
      ]);
      return [
        { label: "Name", value: policyName },
        { label: "Type", value: "Inline Policy" },
        { label: "Role", value: roleName },
        {
          label: "Statements",
          value: safeString(
            (data.PolicyDocument as Record<string, unknown>)?.["Statement"] as unknown,
          ),
        },
      ];
    }

    if (meta?.type === "managed-policy") {
      const { policyArn } = meta;
      const data = await runAwsJsonAsync<{ Policy: AwsManagedPolicy }>([
        "iam",
        "get-policy",
        "--policy-arn",
        policyArn,
      ]);
      const p = data.Policy;
      return [
        { label: "Name", value: p.PolicyName },
        { label: "Type", value: "Managed Policy" },
        { label: "ARN", value: p.Arn },
        { label: "Path", value: p.Path ?? "/" },
        { label: "Description", value: p.Description ?? "-" },
        { label: "Default Version", value: p.DefaultVersionId ?? "-" },
        {
          label: "Attachment Count",
          value: p.AttachmentCount !== undefined ? String(p.AttachmentCount) : "-",
        },
        { label: "Created", value: formatDate(p.CreateDate) },
        { label: "Updated", value: formatDate(p.UpdateDate) },
      ];
    }

    const label = getCellValue(row.cells.name) ?? row.id;
    return [
      { label: "Name", value: label },
      { label: "Type", value: safeString(meta?.type ?? "Item") },
    ];
  };

  return {
    getDetails,
  };
}
