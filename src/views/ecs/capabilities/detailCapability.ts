import type { DetailCapability, DetailField } from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsEcsCluster, AwsEcsService, AwsEcsTask, ECSLevel, ECSRowMeta } from "../types.js";
import { debugLog } from "../../../utils/debugLogger.js";

export function createECSDetailCapability(
  region?: string,
  getLevel?: () => ECSLevel,
): DetailCapability {
  const regionArgs = buildRegionArgs(region);

  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const meta = row.meta as ECSRowMeta | undefined;
    if (!meta) return [];

    const level = getLevel?.();

    if (level?.kind === "clusters" && meta.type === "cluster") {
      try {
        const data = await runAwsJsonAsync<{ clusters: AwsEcsCluster[] }>([
          "ecs",
          "describe-clusters",
          "--clusters",
          meta.clusterArn,
          ...regionArgs,
        ]);
        const cluster = data.clusters?.[0];
        if (!cluster) return [];

        return [
          { label: "Cluster Name", value: cluster.clusterName },
          { label: "Cluster ARN", value: cluster.clusterArn },
          { label: "Status", value: cluster.status ?? "-" },
          { label: "Active Services", value: String(cluster.activeServicesCount ?? 0) },
          { label: "Running Tasks", value: String(cluster.runningTasksCount ?? 0) },
          { label: "Pending Tasks", value: String(cluster.pendingTasksCount ?? 0) },
          {
            label: "Capacity Providers",
            value: (cluster.capacityProviders ?? []).join(", ") || "-",
          },
        ];
      } catch (e) {
        debugLog("ecs", "getDetails (cluster) failed", e);
        return [];
      }
    }

    if (level?.kind === "services" && meta.type === "service") {
      try {
        const data = await runAwsJsonAsync<{ services: AwsEcsService[] }>([
          "ecs",
          "describe-services",
          "--cluster",
          level.clusterArn,
          "--services",
          meta.serviceArn,
          ...regionArgs,
        ]);
        const svc = data.services?.[0];
        if (!svc) return [];

        const lbs = svc.loadBalancers ?? [];
        return [
          { label: "Service Name", value: svc.serviceName },
          { label: "Service ARN", value: svc.serviceArn },
          { label: "Status", value: svc.status ?? "-" },
          { label: "Desired Count", value: String(svc.desiredCount ?? 0) },
          { label: "Running Count", value: String(svc.runningCount ?? 0) },
          { label: "Pending Count", value: String(svc.pendingCount ?? 0) },
          { label: "Task Definition", value: svc.taskDefinition ?? "-" },
          { label: "Launch Type", value: svc.launchType ?? "-" },
          { label: "Platform Version", value: svc.platformVersion ?? "-" },
          { label: "Scheduling Strategy", value: svc.schedulingStrategy ?? "-" },
          {
            label: "Subnets",
            value: (svc.networkConfiguration?.awsvpcConfiguration?.subnets ?? []).join(", ") || "-",
          },
          {
            label: "Security Groups",
            value: (svc.networkConfiguration?.awsvpcConfiguration?.securityGroups ?? []).join(", ") || "-",
          },
          {
            label: "Load Balancers",
            value:
              lbs.length > 0
                ? lbs
                    .map(
                      (lb) =>
                        lb.targetGroupArn ??
                        lb.loadBalancerName ??
                        `${lb.containerName}:${lb.containerPort}`,
                    )
                    .join(", ")
                : "-",
          },
        ];
      } catch (e) {
        debugLog("ecs", "getDetails (service) failed", e);
        return [];
      }
    }

    if (level?.kind === "tasks" && meta.type === "task") {
      try {
        const data = await runAwsJsonAsync<{ tasks: AwsEcsTask[] }>([
          "ecs",
          "describe-tasks",
          "--cluster",
          level.clusterArn,
          "--tasks",
          meta.taskArn,
          ...regionArgs,
        ]);
        const task = data.tasks?.[0];
        if (!task) return [];

        const eniAttachment = (task.attachments ?? []).find((a) => a.type === "ElasticNetworkInterface");
        const privateIp = eniAttachment?.details?.find((d) => d.name === "privateIPv4Address")?.value;

        const fields: DetailField[] = [
          { label: "Task ARN", value: task.taskArn },
          { label: "Task Definition", value: task.taskDefinitionArn ?? "-" },
          { label: "Status", value: task.lastStatus ?? "-" },
          { label: "Desired Status", value: task.desiredStatus ?? "-" },
          { label: "Launch Type", value: task.launchType ?? "-" },
          { label: "Platform Version", value: task.platformVersion ?? "-" },
          { label: "CPU", value: task.cpu ?? "-" },
          { label: "Memory", value: task.memory ?? "-" },
          { label: "Started At", value: task.startedAt ?? "-" },
        ];

        if (task.stoppedReason) {
          fields.push({ label: "Stopped Reason", value: task.stoppedReason });
        }
        if (task.stoppedAt) {
          fields.push({ label: "Stopped At", value: task.stoppedAt });
        }
        if (privateIp) {
          fields.push({ label: "Private IP", value: privateIp });
        }

        fields.push({
          label: "Containers",
          value:
            (task.containers ?? [])
              .map((c) => `${c.name} (${c.lastStatus ?? "?"})`)
              .join(", ") || "-",
        });

        return fields;
      } catch (e) {
        debugLog("ecs", "getDetails (task) failed", e);
        return [];
      }
    }

    return [];
  };

  return { getDetails };
}
