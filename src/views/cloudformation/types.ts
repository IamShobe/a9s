export type CloudFormationLevel =
  | { kind: "stacks" }
  | { kind: "resources"; stackName: string; stackId: string };

export interface CloudFormationStackMeta extends Record<string, unknown> {
  type: "stack";
  stackName: string;
  stackId: string;
  stackStatus: string;
  creationTime: string;
}

export interface CloudFormationResourceMeta extends Record<string, unknown> {
  type: "resource";
  logicalResourceId: string;
  physicalResourceId: string;
  resourceType: string;
  resourceStatus: string;
  stackName: string;
}

export type CloudFormationRowMeta = CloudFormationStackMeta | CloudFormationResourceMeta;

export interface AwsCloudFormationStack {
  StackName: string;
  StackId?: string;
  StackStatus?: string;
  CreationTime?: string;
  LastUpdatedTime?: string;
  Description?: string;
  Outputs?: Array<{ OutputKey: string; OutputValue: string; Description?: string }>;
  Parameters?: Array<{ ParameterKey: string; ParameterValue: string }>;
  Tags?: Array<{ Key: string; Value: string }>;
  Capabilities?: string[];
  RoleARN?: string;
}

export interface AwsCloudFormationStackResource {
  LogicalResourceId: string;
  PhysicalResourceId?: string;
  ResourceType?: string;
  ResourceStatus?: string;
  LastUpdatedTimestamp?: string;
  DriftInformation?: { StackResourceDriftStatus?: string };
}
