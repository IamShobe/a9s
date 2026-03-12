import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsRDSInstance, AwsRDSSnapshot, RDSLevel, RDSRowMeta } from "../types.js";
import { debugLog } from "../../../utils/debugLogger.js";

export function createRDSDetailCapability(
  region?: string,
  getLevel?: () => RDSLevel,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as RDSRowMeta | undefined;
    if (!meta) return [];

    const level = getLevel?.();

    if (level?.kind === "instances" && meta.type === "instance") {
      try {
        const data = await runAwsJsonAsync<{ DBInstances: AwsRDSInstance[] }>([
          "rds",
          "describe-db-instances",
          "--db-instance-identifier",
          meta.dbInstanceIdentifier,
          ...regionArgs,
        ]);
        const inst = data.DBInstances?.[0];
        if (!inst) return [];

        const fields: DetailField[] = [
          { label: "Identifier", value: inst.DBInstanceIdentifier },
          { label: "ARN", value: inst.DBInstanceArn ?? "-" },
          { label: "Status", value: inst.DBInstanceStatus ?? "-" },
          { label: "Engine", value: `${inst.Engine ?? "-"} ${inst.EngineVersion ?? ""}`.trim() },
          { label: "Class", value: inst.DBInstanceClass ?? "-" },
          { label: "Multi-AZ", value: inst.MultiAZ ? "Yes" : "No" },
          { label: "AZ", value: inst.AvailabilityZone ?? "-" },
          { label: "Endpoint", value: inst.Endpoint?.Address ?? "-" },
          { label: "Port", value: inst.Endpoint?.Port != null ? String(inst.Endpoint.Port) : "-" },
          { label: "Storage", value: inst.AllocatedStorage != null ? `${inst.AllocatedStorage} GiB (${inst.StorageType ?? "-"})` : "-" },
          { label: "Backup Retention", value: inst.BackupRetentionPeriod != null ? `${inst.BackupRetentionPeriod} days` : "-" },
          { label: "KMS Key", value: inst.KmsKeyId ?? "(unencrypted)" },
        ];

        const tags = inst.TagList ?? [];
        if (tags.length > 0) {
          fields.push({
            label: "Tags",
            value: tags.map((t) => `${t.Key}=${t.Value}`).join("\n"),
          });
        }

        return fields;
      } catch (e) {
        debugLog("rds", "getDetails (instance) failed", e);
        return [];
      }
    }

    if (level?.kind === "snapshots" && meta.type === "snapshot") {
      try {
        const data = await runAwsJsonAsync<{ DBSnapshots: AwsRDSSnapshot[] }>([
          "rds",
          "describe-db-snapshots",
          "--db-snapshot-identifier",
          meta.snapshotIdentifier,
          ...regionArgs,
        ]);
        const snap = data.DBSnapshots?.[0];
        if (!snap) return [];

        return [
          { label: "Snapshot ID", value: snap.DBSnapshotIdentifier },
          { label: "ARN", value: snap.DBSnapshotArn ?? "-" },
          { label: "Instance", value: snap.DBInstanceIdentifier ?? "-" },
          { label: "Status", value: snap.Status ?? "-" },
          { label: "Type", value: snap.SnapshotType ?? "-" },
          { label: "Created", value: snap.SnapshotCreateTime ? snap.SnapshotCreateTime.slice(0, 19).replace("T", " ") : "-" },
          { label: "Size", value: snap.AllocatedStorage != null ? `${snap.AllocatedStorage} GiB` : "-" },
          { label: "Encrypted", value: snap.Encrypted ? "Yes" : "No" },
          { label: "Engine", value: `${snap.Engine ?? "-"} ${snap.EngineVersion ?? ""}`.trim() },
        ];
      } catch (e) {
        debugLog("rds", "getDetails (snapshot) failed", e);
        return [];
      }
    }

    return [];
  };

  return { getDetails };
}
