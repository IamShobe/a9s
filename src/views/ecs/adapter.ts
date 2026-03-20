import type { ServiceAdapter, RelatedResource } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import type { BookmarkKeyPart } from "../../utils/bookmarks.js";
import { statusCell } from "../../utils/statusColors.js";
import { runAwsJsonAsync, buildRegionArgs, resolveRegion } from "../../utils/aws.js";
import { createStackState } from "../../utils/createStackState.js";
import type { AwsEcsCluster, AwsEcsService, AwsEcsTask, ECSLevel, ECSRowMeta } from "./types.js";
import { createECSDetailCapability } from "./capabilities/detailCapability.js";
import { createECSYankCapability } from "./capabilities/yankCapability.js";
import { createECSEditCapability } from "./capabilities/editCapability.js";
import { createECSActionCapability } from "./capabilities/actionCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";

interface ECSNavFrame extends NavFrame {
  level: ECSLevel;
}


function shortArn(arn: string): string {
  // arn:aws:ecs:us-east-1:123456789012:cluster/my-cluster → my-cluster
  const parts = arn.split("/");
  return parts[parts.length - 1] ?? arn;
}

function shortTaskArn(arn: string): string {
  // arn:aws:ecs:...:task/cluster-name/taskId → last 12 chars of taskId
  const id = shortArn(arn);
  return id.length > 12 ? id.slice(-12) : id;
}

export function createECSServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const regionArgs = buildRegionArgs(region);
  const { getLevel, setLevel, getBackStack, setBackStack, canGoBack, goBack, pushUiLevel, reset } = createStackState<ECSLevel, ECSNavFrame>({ kind: "clusters" });

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "clusters") {
      return [
        { key: "name", label: "Name" },
        { key: "status", label: "Status", width: 10 },
        { key: "services", label: "Services", width: 10, heatmap: { type: "numeric" } },
        { key: "running", label: "Running", width: 10, heatmap: { type: "numeric" } },
        { key: "pending", label: "Pending", width: 10, heatmap: { type: "numeric" } },
      ];
    }
    if (level.kind === "services") {
      return [
        { key: "name", label: "Name" },
        { key: "status", label: "Status", width: 10 },
        { key: "desired", label: "Desired", width: 9, heatmap: { type: "numeric" } },
        { key: "running", label: "Running", width: 9, heatmap: { type: "numeric" } },
        { key: "pending", label: "Pending", width: 9, heatmap: { type: "numeric" } },
        { key: "taskDef", label: "Task Definition", width: 30 },
      ];
    }
    // tasks level
    return [
      { key: "taskId", label: "Task ID", width: 14 },
      { key: "status", label: "Status", width: 12 },
      { key: "cpu", label: "CPU", width: 8, heatmap: { type: "numeric" } },
      { key: "memory", label: "Memory", width: 8, heatmap: { type: "numeric" } },
      { key: "startedAt", label: "Started At", width: 22, heatmap: { type: "date" } },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "clusters") {
      try {
        const listData = await runAwsJsonAsync<{ clusterArns: string[] }>([
          "ecs",
          "list-clusters",
          ...regionArgs,
        ]);
        const arns = listData.clusterArns ?? [];
        if (arns.length === 0) return [];

        const descData = await runAwsJsonAsync<{ clusters: AwsEcsCluster[] }>([
          "ecs",
          "describe-clusters",
          "--clusters",
          ...arns,
          ...regionArgs,
        ]);

        return (descData.clusters ?? []).map((cluster) => ({
          id: cluster.clusterArn,
          cells: {
            name: textCell(cluster.clusterName),
            status: statusCell(cluster.status ?? "-"),
            services: textCell(String(cluster.activeServicesCount ?? 0)),
            running: textCell(String(cluster.runningTasksCount ?? 0)),
            pending: textCell(String(cluster.pendingTasksCount ?? 0)),
          },
          meta: {
            type: "cluster",
            clusterArn: cluster.clusterArn,
            clusterName: cluster.clusterName,
          } satisfies ECSRowMeta,
        }));
      } catch (e) {
        debugLog("ecs", "getRows (clusters) failed", e);
        return [];
      }
    }

    if (level.kind === "services") {
      const { clusterArn } = level;
      try {
        const listData = await runAwsJsonAsync<{ serviceArns: string[] }>([
          "ecs",
          "list-services",
          "--cluster",
          clusterArn,
          ...regionArgs,
        ]);
        const arns = listData.serviceArns ?? [];
        if (arns.length === 0) return [];

        const descData = await runAwsJsonAsync<{ services: AwsEcsService[] }>([
          "ecs",
          "describe-services",
          "--cluster",
          clusterArn,
          "--services",
          ...arns,
          ...regionArgs,
        ]);

        return (descData.services ?? []).map((svc) => ({
          id: svc.serviceArn,
          cells: {
            name: textCell(svc.serviceName),
            status: statusCell(svc.status ?? "-"),
            desired: textCell(String(svc.desiredCount ?? 0)),
            running: textCell(String(svc.runningCount ?? 0)),
            pending: textCell(String(svc.pendingCount ?? 0)),
            taskDef: textCell(svc.taskDefinition ? shortArn(svc.taskDefinition) : "-"),
          },
          meta: {
            type: "service",
            serviceArn: svc.serviceArn,
            serviceName: svc.serviceName,
            clusterArn,
            ...(svc.taskDefinition !== undefined && { taskDefinition: svc.taskDefinition }),
          } satisfies ECSRowMeta,
        }));
      } catch (e) {
        debugLog("ecs", "getRows (services) failed", e);
        return [];
      }
    }

    // tasks level
    const { clusterArn, serviceName } = level;
    try {
      const listData = await runAwsJsonAsync<{ taskArns: string[] }>([
        "ecs",
        "list-tasks",
        "--cluster",
        clusterArn,
        "--service-name",
        serviceName,
        ...regionArgs,
      ]);
      const arns = listData.taskArns ?? [];
      if (arns.length === 0) return [];

      const descData = await runAwsJsonAsync<{ tasks: AwsEcsTask[] }>([
        "ecs",
        "describe-tasks",
        "--cluster",
        clusterArn,
        "--tasks",
        ...arns,
        ...regionArgs,
      ]);

      return (descData.tasks ?? []).map((task) => {
        const taskId = shortTaskArn(task.taskArn);
        return {
          id: task.taskArn,
          cells: {
            taskId: textCell(taskId),
            status: statusCell(task.lastStatus ?? "-"),
            cpu: textCell(task.cpu ?? "-"),
            memory: textCell(task.memory ?? "-"),
            startedAt: textCell(task.startedAt ?? "-"),
          },
          meta: {
            type: "task",
            taskArn: task.taskArn,
            taskId,
            clusterArn,
          } satisfies ECSRowMeta,
        };
      });
    } catch (e) {
      debugLog("ecs", "getRows (tasks) failed", e);
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as ECSRowMeta | undefined;

    if (level.kind === "clusters") {
      if (!meta || meta.type !== "cluster") return { action: "none" };

      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "services",
        clusterArn: meta.clusterArn,
        clusterName: meta.clusterName,
      });
      return { action: "navigate" };
    }

    if (level.kind === "services") {
      if (!meta || meta.type !== "service") return { action: "none" };

      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "tasks",
        clusterArn: level.clusterArn,
        serviceName: meta.serviceName,
        serviceArn: meta.serviceArn,
      });
      return { action: "navigate" };
    }

    // tasks level: leaf
    return { action: "none" };
  };

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "clusters") return "ecs://";
    if (level.kind === "services") return `ecs://${level.clusterName}`;
    return `ecs://${shortArn(level.clusterArn)}/${level.serviceName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "clusters") return "📦 ECS Clusters";
    if (level.kind === "services") return `📦 ${level.clusterName}`;
    return `📦 ${level.serviceName}`;
  };

  const detailCapability = createECSDetailCapability(region, getLevel);
  const yankCapability = createECSYankCapability();
  const editCapability = createECSEditCapability(region, getLevel);
  const actionCapability = createECSActionCapability(region, getLevel);

  const getRelatedResources = async (row: TableRow): Promise<RelatedResource[]> => {
    const meta = row.meta as ECSRowMeta | undefined;
    if (!meta || meta.type !== "service") return [];
    const clusterName = meta.clusterArn.split("/").pop() ?? meta.clusterArn;
    const { serviceName, taskDefinition: taskDefArn } = meta;
    if (!clusterName || !serviceName) return [];

    let cloudwatchFilterHint = `/ecs/${clusterName}/${serviceName}`; // fallback
    if (taskDefArn) {
      try {
        const data = await runAwsJsonAsync<{
          taskDefinition: {
            containerDefinitions: Array<{
              logConfiguration?: { logDriver?: string; options?: Record<string, string> };
            }>;
          };
        }>(["ecs", "describe-task-definition", "--task-definition", taskDefArn, ...regionArgs]);
        const containers = data.taskDefinition?.containerDefinitions ?? [];
        for (const container of containers) {
          const logOpts = container.logConfiguration;
          if (logOpts?.logDriver === "awslogs" && logOpts.options?.["awslogs-group"]) {
            cloudwatchFilterHint = logOpts.options["awslogs-group"];
            break;
          }
        }
      } catch {
        // keep fallback hint
      }
    }

    return [
      { serviceId: "cloudwatch", label: `CloudWatch logs for ${serviceName}`, filterHint: cloudwatchFilterHint },
      { serviceId: "elb", label: `Load balancers for ${serviceName}`, filterHint: serviceName },
    ];
  };

  const getBrowserUrl = (row: TableRow): string | null => {
    const r = resolveRegion(region);
    const meta = row.meta as ECSRowMeta | undefined;
    if (!meta) return null;
    if (meta.type === "cluster") {
      return `https://${r}.console.aws.amazon.com/ecs/v2/clusters/${meta.clusterName}/services?region=${r}`;
    }
    if (meta.type === "service") {
      const clusterName = meta.clusterArn.split("/").pop() ?? meta.clusterArn;
      return `https://${r}.console.aws.amazon.com/ecs/v2/clusters/${clusterName}/services/${meta.serviceName}/health?region=${r}`;
    }
    if (meta.type === "task") {
      const clusterName = meta.clusterArn.split("/").pop() ?? meta.clusterArn;
      return `https://${r}.console.aws.amazon.com/ecs/v2/clusters/${clusterName}/tasks/${meta.taskId}/configuration?region=${r}`;
    }
    return null;
  };

  return {
    id: "ecs",
    label: "ECS",
    hudColor: SERVICE_COLORS.ecs ?? { bg: "magenta", fg: "white" },
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    pushUiLevel,
    getPath,
    getContextLabel,
    getRelatedResources,
    getBrowserUrl,
    reset,
    getBookmarkKey(row: TableRow): BookmarkKeyPart[] {
      const level = getLevel();
      const meta = row.meta as ECSRowMeta | undefined;
      if (level.kind === "clusters") {
        const clusterName = typeof row.cells.name === "object"
          ? (row.cells.name?.displayName ?? row.id)
          : (row.cells.name ?? row.id);
        return [{ label: "Cluster", displayName: clusterName, id: row.id }];
      }
      if (level.kind === "services") {
        const serviceName = typeof row.cells.name === "object"
          ? (row.cells.name?.displayName ?? row.id)
          : (row.cells.name ?? row.id);
        return [
          { label: "Cluster", displayName: level.clusterName, id: level.clusterArn },
          { label: "Service", displayName: serviceName, id: row.id },
        ];
      }
      // tasks level
      const shortId = meta?.type === "task" ? shortTaskArn(row.id) : row.id;
      return [
        { label: "Cluster", displayName: shortArn(level.clusterArn), id: level.clusterArn },
        { label: "Service", displayName: level.serviceName, id: level.serviceArn },
        { label: "Task", displayName: shortId, id: row.id },
      ];
    },
    restoreFromKey(key: BookmarkKeyPart[]): void {
      if (key.length === 1) {
        setBackStack([]);
        setLevel({ kind: "clusters" });
      } else if (key.length === 2) {
        const clusterArn = key[0]!.id ?? key[0]!.displayName;
        const clusterName = key[0]!.displayName;
        setBackStack([{ level: { kind: "clusters" }, selectedIndex: 0 }]);
        setLevel({ kind: "services", clusterArn, clusterName });
      } else if (key.length >= 3) {
        const clusterArn = key[0]!.id ?? key[0]!.displayName;
        const clusterName = key[0]!.displayName;
        const serviceName = key[1]!.displayName;
        const serviceArn = key[1]!.id ?? key[1]!.displayName;
        setBackStack([
          { level: { kind: "clusters" }, selectedIndex: 0 },
          { level: { kind: "services", clusterArn, clusterName }, selectedIndex: 0 },
        ]);
        setLevel({ kind: "tasks", clusterArn, serviceName, serviceArn });
      }
    },
    capabilities: {
      detail: detailCapability,
      yank: yankCapability,
      edit: editCapability,
      actions: actionCapability,
    },
  };
}
