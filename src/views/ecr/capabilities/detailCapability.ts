import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsECRRepository, ECRLevel, ECRRowMeta } from "../types.js";
import { debugLog } from "../../../utils/debugLogger.js";

export function createECRDetailCapability(
  region?: string,
  getLevel?: () => ECRLevel,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as ECRRowMeta | undefined;
    if (!meta) return [];

    const level = getLevel?.();

    if (level?.kind === "repositories" && meta.type === "repository") {
      try {
        const data = await runAwsJsonAsync<{ repositories: AwsECRRepository[] }>([
          "ecr",
          "describe-repositories",
          "--repository-names",
          meta.repositoryName,
          ...regionArgs,
        ]);
        const repo = data.repositories?.[0];
        if (!repo) return [];
        return [
          { label: "Name", value: meta.repositoryName },
          { label: "ARN", value: meta.repositoryArn },
          { label: "URI", value: meta.repositoryUri },
          { label: "Tag Mutability", value: repo.imageTagMutability ?? "-" },
          { label: "Scan on Push", value: repo.imageScanningConfiguration?.scanOnPush ? "Yes" : "No" },
          { label: "Encryption", value: repo.encryptionConfiguration?.encryptionType ?? "AES256" },
          { label: "Created At", value: repo.createdAt ? repo.createdAt.slice(0, 10) : "-" },
        ];
      } catch (e) {
        debugLog("ecr", "getDetails (repository) failed", e);
        return [];
      }
    }

    if (level?.kind === "images" && meta.type === "image") {
      return [
        { label: "Repository", value: meta.repositoryName },
        { label: "Tag", value: meta.imageTag || "<untagged>" },
        { label: "Digest", value: meta.imageDigest },
        { label: "URI", value: meta.imageTag ? `${meta.repositoryUri}:${meta.imageTag}` : `${meta.repositoryUri}@${meta.imageDigest}` },
        { label: "Pushed At", value: row.cells["pushedAt"]?.displayName ?? "-" },
        { label: "Size", value: row.cells["size"]?.displayName ?? "-" },
      ];
    }

    return [];
  };

  return { getDetails };
}
