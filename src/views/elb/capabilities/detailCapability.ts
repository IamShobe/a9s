import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type {
  AwsLoadBalancer,
  AwsTargetGroup,
  AwsTargetHealthDescription,
  ELBLevel,
  ELBRowMeta,
} from "../types.js";
import { debugLog } from "../../../utils/debugLogger.js";

export function createELBDetailCapability(
  region?: string,
  getLevel?: () => ELBLevel,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as ELBRowMeta | undefined;
    if (!meta) return [];

    const level = getLevel?.();

    if (level?.kind === "load-balancers" && meta.type === "load-balancer") {
      try {
        const data = await runAwsJsonAsync<{ LoadBalancers: AwsLoadBalancer[] }>([
          "elbv2",
          "describe-load-balancers",
          "--load-balancer-arns",
          meta.lbArn,
          ...regionArgs,
        ]);
        const lb = data.LoadBalancers?.[0];
        if (!lb) return [];

        const azs = (lb.AvailabilityZones ?? []).map((az) => az.ZoneName).join(", ");
        return [
          { label: "Name", value: lb.LoadBalancerName },
          { label: "ARN", value: lb.LoadBalancerArn },
          { label: "Type", value: lb.Type },
          { label: "State", value: lb.State?.Code ?? "-" },
          { label: "Scheme", value: lb.Scheme ?? "-" },
          { label: "DNS Name", value: lb.DNSName ?? "-" },
          { label: "VPC", value: lb.VpcId ?? "-" },
          { label: "AZs", value: azs || "-" },
          {
            label: "Security Groups",
            value: (lb.SecurityGroups ?? []).join(", ") || "-",
          },
          { label: "IP Address Type", value: lb.IpAddressType ?? "-" },
          { label: "Created", value: lb.CreatedTime ?? "-" },
        ];
      } catch (e) {
        debugLog("elb", "getDetails (load-balancer) failed", e);
        return [];
      }
    }

    if (level?.kind === "target-groups" && meta.type === "target-group") {
      try {
        const data = await runAwsJsonAsync<{ TargetGroups: AwsTargetGroup[] }>([
          "elbv2",
          "describe-target-groups",
          "--target-group-arns",
          meta.tgArn,
          ...regionArgs,
        ]);
        const tg = data.TargetGroups?.[0];
        if (!tg) return [];

        return [
          { label: "Name", value: tg.TargetGroupName },
          { label: "ARN", value: tg.TargetGroupArn },
          { label: "Protocol", value: tg.Protocol ?? "-" },
          { label: "Port", value: tg.Port != null ? String(tg.Port) : "-" },
          { label: "Target Type", value: tg.TargetType ?? "-" },
          { label: "VPC", value: tg.VpcId ?? "-" },
          { label: "Health Check Protocol", value: tg.HealthCheckProtocol ?? "-" },
          { label: "Health Check Path", value: tg.HealthCheckPath ?? "-" },
          {
            label: "Health Check Interval",
            value:
              tg.HealthCheckIntervalSeconds != null
                ? `${tg.HealthCheckIntervalSeconds}s`
                : "-",
          },
          {
            label: "Healthy Threshold",
            value: tg.HealthyThresholdCount != null ? String(tg.HealthyThresholdCount) : "-",
          },
          {
            label: "Unhealthy Threshold",
            value: tg.UnhealthyThresholdCount != null ? String(tg.UnhealthyThresholdCount) : "-",
          },
        ];
      } catch (e) {
        debugLog("elb", "getDetails (target-group) failed", e);
        return [];
      }
    }

    if (level?.kind === "targets" && meta.type === "target") {
      try {
        const data = await runAwsJsonAsync<{
          TargetHealthDescriptions: AwsTargetHealthDescription[];
        }>([
          "elbv2",
          "describe-target-health",
          "--target-group-arn",
          level.tgArn,
          "--targets",
          `Id=${meta.targetId}`,
          ...regionArgs,
        ]);
        const desc = data.TargetHealthDescriptions?.[0];
        if (!desc) return [];

        return [
          { label: "Target ID", value: desc.Target.Id },
          { label: "Port", value: desc.Target.Port != null ? String(desc.Target.Port) : "-" },
          { label: "AZ", value: desc.Target.AvailabilityZone ?? "-" },
          { label: "Health State", value: desc.TargetHealth.State },
          { label: "Health Check Port", value: desc.HealthCheckPort ?? "-" },
          { label: "Description", value: desc.TargetHealth.Description ?? "-" },
          { label: "Reason", value: desc.TargetHealth.Reason ?? "-" },
        ];
      } catch (e) {
        debugLog("elb", "getDetails (target) failed", e);
        return [];
      }
    }

    return [];
  };

  return { getDetails };
}
