export interface AwsLoadBalancerState {
  Code: string;
  Reason?: string;
}

export interface AwsLoadBalancerAZ {
  ZoneName: string;
  SubnetId?: string;
}

export interface AwsLoadBalancer {
  LoadBalancerArn: string;
  LoadBalancerName: string;
  Type: string; // "application" | "network" | "gateway"
  State?: AwsLoadBalancerState;
  DNSName?: string;
  Scheme?: string; // "internet-facing" | "internal"
  VpcId?: string;
  AvailabilityZones?: AwsLoadBalancerAZ[];
  SecurityGroups?: string[];
  IpAddressType?: string;
  CreatedTime?: string;
}

export interface AwsTargetGroup {
  TargetGroupArn: string;
  TargetGroupName: string;
  Protocol?: string;
  Port?: number;
  VpcId?: string;
  TargetType?: string; // "instance" | "ip" | "lambda" | "alb"
  HealthCheckProtocol?: string;
  HealthCheckPath?: string;
  HealthCheckIntervalSeconds?: number;
  HealthyThresholdCount?: number;
  UnhealthyThresholdCount?: number;
  LoadBalancerArns?: string[];
}

export interface AwsTargetHealth {
  State: string;
  Description?: string;
  Reason?: string;
}

export interface AwsTargetDescription {
  Id: string;
  Port?: number;
  AvailabilityZone?: string;
}

export interface AwsTargetHealthDescription {
  Target: AwsTargetDescription;
  HealthCheckPort?: string;
  TargetHealth: AwsTargetHealth;
}

export type ELBLevel =
  | { kind: "load-balancers" }
  | { kind: "target-groups"; lbArn: string; lbName: string; lbType: string }
  | { kind: "targets"; tgArn: string; tgName: string; lbArn: string };

export interface ELBLoadBalancerMeta extends Record<string, unknown> {
  type: "load-balancer";
  lbArn: string;
  lbName: string;
  lbType: string;
  dnsName: string;
  scheme: string;
}

export interface ELBTargetGroupMeta extends Record<string, unknown> {
  type: "target-group";
  tgArn: string;
  tgName: string;
  lbArn: string;
}

export interface ELBTargetMeta extends Record<string, unknown> {
  type: "target";
  targetId: string;
  health: string;
  tgArn: string;
}

export type ELBRowMeta = ELBLoadBalancerMeta | ELBTargetGroupMeta | ELBTargetMeta;
