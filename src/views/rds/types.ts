export interface AwsRDSTag {
  Key: string;
  Value: string;
}

export interface AwsRDSInstance {
  DBInstanceIdentifier: string;
  DBInstanceArn?: string;
  Engine?: string;
  EngineVersion?: string;
  DBInstanceClass?: string;
  DBInstanceStatus?: string;
  MultiAZ?: boolean;
  AvailabilityZone?: string;
  Endpoint?: {
    Address?: string;
    Port?: number;
  };
  AllocatedStorage?: number;
  StorageType?: string;
  BackupRetentionPeriod?: number;
  KmsKeyId?: string;
  TagList?: AwsRDSTag[];
}

export interface AwsRDSSnapshot {
  DBSnapshotIdentifier: string;
  DBSnapshotArn?: string;
  DBInstanceIdentifier?: string;
  Status?: string;
  SnapshotType?: string;
  SnapshotCreateTime?: string;
  AllocatedStorage?: number;
  Encrypted?: boolean;
  Engine?: string;
  EngineVersion?: string;
  TagList?: AwsRDSTag[];
}

export type RDSLevel =
  | { kind: "instances" }
  | { kind: "snapshots"; dbInstanceIdentifier: string; dbInstanceClass: string };

export interface RDSInstanceMeta extends Record<string, unknown> {
  type: "instance";
  dbInstanceIdentifier: string;
  dbInstanceArn: string;
  engine: string;
  engineVersion: string;
  dbInstanceClass: string;
  status: string;
  multiAZ: boolean;
}

export interface RDSSnapshotMeta extends Record<string, unknown> {
  type: "snapshot";
  snapshotIdentifier: string;
  snapshotArn: string;
  dbInstanceIdentifier: string;
  status: string;
  snapshotType: string;
}

export type RDSRowMeta = RDSInstanceMeta | RDSSnapshotMeta;
