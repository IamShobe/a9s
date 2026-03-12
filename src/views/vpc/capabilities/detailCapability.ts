import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsVPC, AwsSecurityGroup, VPCLevel, VPCRowMeta } from "../types.js";
import { debugLog } from "../../../utils/debugLogger.js";

export function createVPCDetailCapability(
  region?: string,
  getLevel?: () => VPCLevel,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as VPCRowMeta | undefined;
    if (!meta) return [];

    const level = getLevel?.();

    if (level?.kind === "vpcs" && meta.type === "vpc") {
      try {
        const data = await runAwsJsonAsync<{ Vpcs: AwsVPC[] }>([
          "ec2",
          "describe-vpcs",
          "--vpc-ids",
          meta.vpcId,
          ...regionArgs,
        ]);
        const vpc = data.Vpcs?.[0];
        if (!vpc) return [];
        return [
          { label: "VPC ID", value: meta.vpcId },
          { label: "Name", value: meta.vpcName || "-" },
          { label: "CIDR Block", value: vpc.CidrBlock },
          { label: "State", value: vpc.State },
          { label: "Is Default", value: vpc.IsDefault ? "Yes" : "No" },
          { label: "DHCP Options", value: vpc.DhcpOptionsId ?? "-" },
          { label: "Tenancy", value: vpc.InstanceTenancy ?? "-" },
          { label: "Owner ID", value: vpc.OwnerId ?? "-" },
        ];
      } catch (e) {
        debugLog("vpc", "getDetails (vpc) failed", e);
        return [];
      }
    }

    if (level?.kind === "security-groups" && meta.type === "security-group") {
      try {
        const data = await runAwsJsonAsync<{ SecurityGroups: AwsSecurityGroup[] }>([
          "ec2",
          "describe-security-groups",
          "--group-ids",
          meta.sgId,
          ...regionArgs,
        ]);
        const sg = data.SecurityGroups?.[0];
        if (!sg) return [];
        const inboundCount = sg.IpPermissions?.length ?? 0;
        const outboundCount = sg.IpPermissionsEgress?.length ?? 0;
        return [
          { label: "Group ID", value: meta.sgId },
          { label: "Name", value: meta.sgName },
          { label: "Description", value: sg.Description },
          { label: "VPC ID", value: sg.VpcId },
          { label: "Owner ID", value: sg.OwnerId ?? "-" },
          { label: "Inbound Rules", value: String(inboundCount) },
          { label: "Outbound Rules", value: String(outboundCount) },
        ];
      } catch (e) {
        debugLog("vpc", "getDetails (sg) failed", e);
        return [];
      }
    }

    if (level?.kind === "rules" && meta.type === "rule") {
      return [
        { label: "Direction", value: meta.direction === "inbound" ? "Inbound" : "Outbound" },
        { label: "Protocol", value: meta.protocol },
        { label: "Port Range", value: meta.portRange },
        { label: "Source / Destination", value: meta.sourceDest },
        { label: "Security Group", value: meta.sgId },
      ];
    }

    return [];
  };

  return { getDetails };
}
