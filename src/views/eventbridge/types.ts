import type { NavFrame } from "../../types.js";

export type EventBridgeLevel =
  | { kind: "buses" }
  | { kind: "rules"; busName: string };

export interface EventBridgeNavFrame extends NavFrame {
  level: EventBridgeLevel;
}

export interface EBRuleMeta extends Record<string, unknown> {
  type: "rule";
  ruleName: string;
  ruleArn: string;
  busName: string;
  state: string;
  schedule?: string;
  eventPattern?: string;
}

export interface EBBusMeta extends Record<string, unknown> {
  type: "bus";
  busName: string;
  busArn: string;
}

export type EventBridgeRowMeta = EBBusMeta | EBRuleMeta;

export interface AwsEventBus {
  Name: string;
  Arn: string;
  Policy?: string;
}

export interface AwsEventRule {
  Name: string;
  Arn: string;
  State?: string;
  ScheduleExpression?: string;
  EventPattern?: string;
  Description?: string;
  Targets?: number;
  EventBusName?: string;
}
