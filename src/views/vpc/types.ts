export type VPCLevel =
  | { kind: "vpcs" }
  | { kind: "security-groups"; vpcId: string; vpcName: string }
  | { kind: "rules"; sgId: string; sgName: string; vpcId: string };

export interface VPCMeta extends Record<string, unknown> {
  type: "vpc";
  vpcId: string;
  vpcName: string;
  cidr: string;
}

export interface SGMeta extends Record<string, unknown> {
  type: "security-group";
  sgId: string;
  sgName: string;
  vpcId: string;
}

export interface RuleMeta extends Record<string, unknown> {
  type: "rule";
  direction: "inbound" | "outbound";
  protocol: string;
  portRange: string;
  sourceDest: string;
  sgId: string;
}

export type VPCRowMeta = VPCMeta | SGMeta | RuleMeta;

export interface AwsVPC {
  VpcId: string;
  CidrBlock: string;
  State: string;
  IsDefault: boolean;
  Tags?: { Key: string; Value: string }[];
  DhcpOptionsId?: string;
  InstanceTenancy?: string;
  OwnerId?: string;
}

export interface AwsIpRange {
  CidrIp?: string;
  Description?: string;
}

export interface AwsIpv6Range {
  CidrIpv6?: string;
  Description?: string;
}

export interface AwsUserIdGroupPair {
  GroupId?: string;
  Description?: string;
}

export interface AwsPrefixListId {
  PrefixListId?: string;
  Description?: string;
}

export interface AwsIpPermission {
  IpProtocol: string;
  FromPort?: number;
  ToPort?: number;
  IpRanges?: AwsIpRange[];
  Ipv6Ranges?: AwsIpv6Range[];
  UserIdGroupPairs?: AwsUserIdGroupPair[];
  PrefixListIds?: AwsPrefixListId[];
}

export interface AwsSecurityGroup {
  GroupId: string;
  GroupName: string;
  Description: string;
  VpcId: string;
  OwnerId?: string;
  IpPermissions?: AwsIpPermission[];
  IpPermissionsEgress?: AwsIpPermission[];
  Tags?: { Key: string; Value: string }[];
}
