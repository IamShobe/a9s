import type {
  DetailCapability,
  DetailField,
} from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync } from "../../../utils/aws.js";
import type { AwsSecret, SecretRowMeta, SecretLevel } from "../types.js";

export function createSecretsManagerDetailCapability(
  region?: string,
  getLevel?: () => SecretLevel,
): DetailCapability {
  const regionArgs = region ? ["--region", region] : [];

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as SecretRowMeta | undefined;
    if (!meta) {
      return [];
    }

    const level = getLevel?.();

    // Level 1: Secret details
    if (level?.kind === "secrets" && meta.type === "secret") {
      const data = await runAwsJsonAsync<AwsSecret>([
        "secretsmanager",
        "describe-secret",
        "--secret-id",
        meta.arn!,
        ...regionArgs,
      ]);

      const fields: DetailField[] = [
        { label: "Name", value: String(data.Name ?? "-") },
        { label: "ARN", value: String(data.ARN ?? "-") },
        { label: "Description", value: String(data.Description ?? "-") },
        { label: "Last Changed", value: String(data.LastChangedDate ?? "-") },
        { label: "Last Rotated", value: String(data.LastRotatedDate ?? "-") },
        { label: "Rotation Enabled", value: data.RotationEnabled ? "Yes" : "No" },
        { label: "KMS Key ID", value: String(data.KmsKeyId ?? "-") },
        {
          label: "Tags",
          value: data.Tags && data.Tags.length > 0 ? `${data.Tags.length} tag(s)` : "-",
        },
      ];

      return fields;
    }

    // Level 2: Field details
    if (level?.kind === "secret-fields" && meta.type === "secret-field") {
      const fields: DetailField[] = [
        { label: "Field Key", value: String(meta.key ?? "-") },
        { label: "Secret Name", value: String(meta.secretName ?? "-") },
        { label: "Value", value: String(meta.value ?? "-") },
      ];
      return fields;
    }

    return [];
  };

  return { getDetails };
}
