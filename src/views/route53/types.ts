export interface AwsHostedZone {
  Id: string; // e.g., "/hostedzone/Z123456"
  Name: string;
  Config?: {
    PrivateZone?: boolean;
    Comment?: string;
  };
  ResourceRecordSetCount?: number;
  CallerReference?: string;
  HostedZoneConfig?: {
    PrivateZone?: boolean;
    Comment?: string;
  };
}

export interface AwsResourceRecord {
  Value: string;
}

export interface AwsAliasTarget {
  HostedZoneId: string;
  DNSName: string;
  EvaluateTargetHealth: boolean;
}

export interface AwsResourceRecordSet {
  Name: string;
  Type: string;
  TTL?: number;
  SetIdentifier?: string;
  Weight?: number;
  Region?: string;
  GeoLocation?: {
    ContinentCode?: string;
    CountryCode?: string;
    SubdivisionCode?: string;
  };
  AliasTarget?: AwsAliasTarget;
  ResourceRecords?: AwsResourceRecord[];
  HealthCheckId?: string;
  TrafficPolicyInstanceId?: string;
}

export type Route53Level =
  | { kind: "zones" }
  | { kind: "records"; zoneId: string; zoneName: string };

export interface Route53RowMeta extends Record<string, unknown> {
  type: "zone" | "record";
  zoneId?: string;
  zoneName?: string;
  isPrivate?: boolean;
  recordName?: string;
  recordType?: string;
  recordTtl?: number | undefined;
  recordValues?: string[];
  recordAliasTarget?: AwsAliasTarget | undefined;
}
