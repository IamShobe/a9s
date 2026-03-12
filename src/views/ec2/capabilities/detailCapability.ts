import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsReservation, AwsVolume, EC2Level, EC2RowMeta } from "../types.js";
import { debugLog } from "../../../utils/debugLogger.js";

export function createEC2DetailCapability(
  region?: string,
  getLevel?: () => EC2Level,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as EC2RowMeta | undefined;
    if (!meta) return [];

    const level = getLevel?.();

    if (level?.kind === "instances" && meta.type === "instance") {
      try {
        const data = await runAwsJsonAsync<{ Reservations: AwsReservation[] }>([
          "ec2",
          "describe-instances",
          "--instance-ids",
          meta.instanceId,
          ...regionArgs,
        ]);
        const inst = data.Reservations?.[0]?.Instances?.[0];
        if (!inst) return [];

        const tags = Object.fromEntries((inst.Tags ?? []).map((t) => [t.Key, t.Value]));

        const fields: DetailField[] = [
          { label: "Instance ID", value: inst.InstanceId },
          { label: "State", value: inst.State?.Name ?? "-" },
          { label: "Type", value: inst.InstanceType ?? "-" },
          { label: "AMI", value: inst.ImageId ?? "-" },
          { label: "Architecture", value: inst.Architecture ?? "-" },
          { label: "Key Pair", value: inst.KeyName ?? "-" },
          { label: "Public IP", value: inst.PublicIpAddress ?? "-" },
          { label: "Private IP", value: inst.PrivateIpAddress ?? "-" },
          { label: "AZ", value: inst.Placement?.AvailabilityZone ?? "-" },
          { label: "VPC", value: inst.VpcId ?? "-" },
          { label: "Subnet", value: inst.SubnetId ?? "-" },
          {
            label: "Security Groups",
            value:
              (inst.SecurityGroups ?? []).map((sg) => `${sg.GroupName} (${sg.GroupId})`).join(", ") || "-",
          },
          { label: "IAM Role", value: inst.IamInstanceProfile?.Arn ?? "-" },
          { label: "Launch Time", value: inst.LaunchTime ?? "-" },
        ];

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
        debugLog("ec2", "getDetails (instance) failed", e);
        return [];
      }
    }

    if (level?.kind === "volumes" && meta.type === "volume") {
      try {
        const data = await runAwsJsonAsync<{ Volumes: AwsVolume[] }>([
          "ec2",
          "describe-volumes",
          "--volume-ids",
          meta.volumeId,
          ...regionArgs,
        ]);
        const vol = data.Volumes?.[0];
        if (!vol) return [];

        const attachment = vol.Attachments?.[0];
        return [
          { label: "Volume ID", value: vol.VolumeId },
          { label: "Size", value: vol.Size != null ? `${vol.Size} GiB` : "-" },
          { label: "State", value: vol.State ?? "-" },
          { label: "Type", value: vol.VolumeType ?? "-" },
          { label: "AZ", value: vol.AvailabilityZone ?? "-" },
          { label: "Encrypted", value: vol.Encrypted ? "Yes" : "No" },
          { label: "Created", value: vol.CreateTime ?? "-" },
          { label: "Attachment State", value: attachment?.State ?? "-" },
          { label: "Device", value: attachment?.Device ?? "-" },
        ];
      } catch (e) {
        debugLog("ec2", "getDetails (volume) failed", e);
        return [];
      }
    }

    return [];
  };

  return { getDetails };
}
