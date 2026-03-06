import type { EditCapability } from "../../../adapters/capabilities/EditCapability.js";
import type { TableRow, SelectResult } from "../../../types.js";
import { runAwsJsonAsync } from "../../../utils/aws.js";
import { writeTempJsonFile } from "../utils.js";
import type { IamLevel, IamRowMeta, AwsRole, AwsManagedPolicy } from "../types.js";

function getIamMeta(row: TableRow): IamRowMeta | undefined {
  return row.meta as IamRowMeta | undefined;
}

export function createIamEditCapability(
  _getLevel: () => IamLevel,
): EditCapability {
  const onEdit = async (row: TableRow): Promise<SelectResult> => {
    const meta = getIamMeta(row);

    if (meta?.type === "role") {
      const roleName = meta.roleName;
      const roleData = await runAwsJsonAsync<{ Role: AwsRole }>([
        "iam",
        "get-role",
        "--role-name",
        roleName,
      ]);
      const trust = roleData.Role.AssumeRolePolicyDocument ?? {};
      const filePath = await writeTempJsonFile(
        `${roleName}-trust-policy`,
        trust,
      );
      return { action: "edit", filePath, metadata: {} };
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
      const filePath = await writeTempJsonFile(
        `${roleName}-${policyName}-inline-policy`,
        data.PolicyDocument ?? {},
      );
      return { action: "edit", filePath, metadata: {} };
    }

    if (meta?.type === "managed-policy") {
      const { policyArn, policyName } = meta;
      const policyMeta = await runAwsJsonAsync<{ Policy: AwsManagedPolicy }>([
        "iam",
        "get-policy",
        "--policy-arn",
        policyArn,
      ]);
      const versionId = policyMeta.Policy.DefaultVersionId;
      if (!versionId) return { action: "none" };
      const policyVersion = await runAwsJsonAsync<{
        PolicyVersion?: { Document?: unknown };
      }>([
        "iam",
        "get-policy-version",
        "--policy-arn",
        policyArn,
        "--version-id",
        versionId,
      ]);
      const filePath = await writeTempJsonFile(
        `${policyName || "policy"}-${versionId}`,
        policyVersion.PolicyVersion?.Document ?? {},
      );
      return { action: "edit", filePath, metadata: {} };
    }

    return { action: "none" };
  };

  const uploadFile = async (
    _filePath: string,
    _metadata: Record<string, unknown>,
  ): Promise<void> => {
    // IAM doesn't support file upload for now
    throw new Error("Upload not supported for IAM");
  };

  return {
    onEdit,
    uploadFile,
  };
}
