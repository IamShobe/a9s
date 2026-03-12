import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsEBSVolume, AwsEBSSnapshot, EBSLevel, EBSRowMeta } from "../types.js";
import { debugLog } from "../../../utils/debugLogger.js";

export function createEBSDetailCapability(
  region?: string,
  getLevel?: () => EBSLevel,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as EBSRowMeta | undefined;
    if (!meta) return [];

    const level = getLevel?.();

    if (level?.kind === "volumes" && meta.type === "volume") {
      try {
        const data = await runAwsJsonAsync<{ Volumes: AwsEBSVolume[] }>([
          "ec2",
          "describe-volumes",
          "--volume-ids",
          meta.volumeId,
          ...regionArgs,
        ]);
        const vol = data.Volumes?.[0];
        if (!vol) return [];

        const tags = Object.fromEntries((vol.Tags ?? []).map((t) => [t.Key, t.Value]));
        const attachment = vol.Attachments?.[0];

        const fields: DetailField[] = [
          { label: "Volume ID", value: vol.VolumeId },
          { label: "State", value: vol.State ?? "-" },
          { label: "Size", value: vol.Size != null ? `${vol.Size} GiB` : "-" },
          { label: "Type", value: vol.VolumeType ?? "-" },
          { label: "AZ", value: vol.AvailabilityZone ?? "-" },
          { label: "Encrypted", value: vol.Encrypted ? "Yes" : "No" },
          { label: "IOPS", value: vol.Iops != null ? String(vol.Iops) : "-" },
          { label: "Throughput", value: vol.Throughput != null ? `${vol.Throughput} MiB/s` : "-" },
          { label: "Snapshot ID", value: vol.SnapshotId ?? "(no snapshot)" },
          { label: "Multi-Attach", value: vol.MultiAttachEnabled ? "Yes" : "No" },
          { label: "Created", value: vol.CreateTime ?? "-" },
        ];

        if (attachment) {
          fields.push({ label: "Attached Instance", value: attachment.InstanceId });
          fields.push({ label: "Device", value: attachment.Device });
          fields.push({
            label: "Delete on Termination",
            value: attachment.DeleteOnTermination ? "Yes" : "No",
          });
        }

        if (Object.keys(tags).length > 0) {
          fields.push({
            label: "Tags",
            value: Object.entries(tags)
              .map(([k, v]) => `${k}=${v}`)
              .join("\n"),
          });
        }

        return fields;
      } catch (e) {
        debugLog("ebs", "getDetails (volume) failed", e);
        return [];
      }
    }

    if (level?.kind === "snapshots" && meta.type === "snapshot") {
      try {
        const data = await runAwsJsonAsync<{ Snapshots: AwsEBSSnapshot[] }>([
          "ec2",
          "describe-snapshots",
          "--snapshot-ids",
          meta.snapshotId,
          ...regionArgs,
        ]);
        const snap = data.Snapshots?.[0];
        if (!snap) return [];

        const tags = Object.fromEntries((snap.Tags ?? []).map((t) => [t.Key, t.Value]));
        return [
          { label: "Snapshot ID", value: snap.SnapshotId },
          { label: "Volume ID", value: snap.VolumeId },
          { label: "State", value: snap.State },
          { label: "Progress", value: snap.Progress ?? "-" },
          { label: "Volume Size", value: snap.VolumeSize != null ? `${snap.VolumeSize} GiB` : "-" },
          { label: "Encrypted", value: snap.Encrypted ? "Yes" : "No" },
          { label: "Owner", value: snap.OwnerId ?? "-" },
          { label: "Started", value: snap.StartTime ?? "-" },
          { label: "Description", value: snap.Description || "(none)" },
          ...(Object.keys(tags).length > 0
            ? [
                {
                  label: "Tags",
                  value: Object.entries(tags)
                    .map(([k, v]) => `${k}=${v}`)
                    .join("\n"),
                },
              ]
            : []),
        ];
      } catch (e) {
        debugLog("ebs", "getDetails (snapshot) failed", e);
        return [];
      }
    }

    return [];
  };

  return { getDetails };
}
