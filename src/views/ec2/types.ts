export interface AwsTag {
  Key: string;
  Value: string;
}

export interface AwsInstanceState {
  Name: string;
  Code?: number;
}

export interface AwsSecurityGroup {
  GroupId: string;
  GroupName: string;
}

export interface AwsIamInstanceProfile {
  Arn: string;
  Id?: string;
}

export interface AwsInstance {
  InstanceId: string;
  State?: AwsInstanceState;
  InstanceType?: string;
  PublicIpAddress?: string;
  PrivateIpAddress?: string;
  Placement?: { AvailabilityZone: string };
  Tags?: AwsTag[];
  ImageId?: string;
  VpcId?: string;
  SubnetId?: string;
  SecurityGroups?: AwsSecurityGroup[];
  IamInstanceProfile?: AwsIamInstanceProfile;
  LaunchTime?: string;
  KeyName?: string;
  Architecture?: string;
}

export interface AwsReservation {
  Instances: AwsInstance[];
}

export interface AwsVolumeAttachment {
  Device: string;
  InstanceId: string;
  State: string;
}

export interface AwsVolume {
  VolumeId: string;
  Size?: number;
  State?: string;
  Attachments?: AwsVolumeAttachment[];
  AvailabilityZone?: string;
  VolumeType?: string;
  Encrypted?: boolean;
  CreateTime?: string;
}

export type EC2Level =
  | { kind: "instances" }
  | { kind: "volumes"; instanceId: string; instanceName: string };

export interface EC2InstanceMeta extends Record<string, unknown> {
  type: "instance";
  instanceId: string;
  instanceName: string;
  state: string;
  publicIp: string;
  privateIp: string;
  vpcId?: string;
}

export interface EC2VolumeMeta extends Record<string, unknown> {
  type: "volume";
  volumeId: string;
  instanceId: string;
  instanceName: string;
}

export type EC2RowMeta = EC2InstanceMeta | EC2VolumeMeta;
