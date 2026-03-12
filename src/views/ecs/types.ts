export interface AwsEcsCluster {
  clusterArn: string;
  clusterName: string;
  status?: string;
  activeServicesCount?: number;
  runningTasksCount?: number;
  pendingTasksCount?: number;
  capacityProviders?: string[];
}

export interface AwsEcsService {
  serviceArn: string;
  serviceName: string;
  clusterArn: string;
  status?: string;
  desiredCount?: number;
  runningCount?: number;
  pendingCount?: number;
  taskDefinition?: string;
  loadBalancers?: Array<{
    targetGroupArn?: string;
    loadBalancerName?: string;
    containerName?: string;
    containerPort?: number;
  }>;
}

export interface AwsEcsTask {
  taskArn: string;
  taskDefinitionArn?: string;
  clusterArn?: string;
  lastStatus?: string;
  desiredStatus?: string;
  cpu?: string;
  memory?: string;
  startedAt?: string;
  containers?: Array<{ name: string; lastStatus?: string }>;
}

export type ECSLevel =
  | { kind: "clusters" }
  | { kind: "services"; clusterArn: string; clusterName: string }
  | { kind: "tasks"; clusterArn: string; serviceName: string; serviceArn: string };

export interface ECSClusterMeta extends Record<string, unknown> {
  type: "cluster";
  clusterArn: string;
  clusterName: string;
}

export interface ECSServiceMeta extends Record<string, unknown> {
  type: "service";
  serviceArn: string;
  serviceName: string;
  clusterArn: string;
}

export interface ECSTaskMeta extends Record<string, unknown> {
  type: "task";
  taskArn: string;
  taskId: string;
  clusterArn: string;
}

export type ECSRowMeta = ECSClusterMeta | ECSServiceMeta | ECSTaskMeta;
