export interface AwsEBSTag {
  Key: string;
  Value: string;
}

export interface AwsEBSVolumeAttachment {
  InstanceId: string;
  State: string;
  Device: string;
  DeleteOnTermination?: boolean;
}

export interface AwsEBSVolume {
  VolumeId: string;
  Size?: number;
  State?: string;
  VolumeType?: string;
  AvailabilityZone?: string;
  Encrypted?: boolean;
  Iops?: number;
  Throughput?: number;
  CreateTime?: string;
  Attachments?: AwsEBSVolumeAttachment[];
  Tags?: AwsEBSTag[];
  SnapshotId?: string;
  MultiAttachEnabled?: boolean;
}

export interface AwsEBSSnapshot {
  SnapshotId: string;
  VolumeId: string;
  State: string;
  Progress?: string;
  StartTime?: string;
  Description?: string;
  VolumeSize?: number;
  Encrypted?: boolean;
  OwnerId?: string;
  Tags?: AwsEBSTag[];
}

export type EBSLevel =
  | { kind: "volumes" }
  | { kind: "snapshots"; volumeId: string; volumeSize: number };

export interface EBSVolumeMeta extends Record<string, unknown> {
  type: "volume";
  volumeId: string;
  state: string;
  attachedInstanceId: string;
}

export interface EBSSnapshotMeta extends Record<string, unknown> {
  type: "snapshot";
  snapshotId: string;
  volumeId: string;
  state: string;
}

export type EBSRowMeta = EBSVolumeMeta | EBSSnapshotMeta;
