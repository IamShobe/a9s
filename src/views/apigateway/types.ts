import type { NavFrame } from "../../types.js";

export type ApiGatewayLevel =
  | { kind: "apis" }
  | { kind: "stages"; apiId: string; apiName: string }
  | { kind: "resources"; apiId: string; apiName: string; stageName: string };

export interface ApiGatewayNavFrame extends NavFrame {
  level: ApiGatewayLevel;
}

export interface AGWApiMeta extends Record<string, unknown> {
  type: "api";
  apiId: string;
  apiName: string;
  protocol: string;
}

export interface AGWStageMeta extends Record<string, unknown> {
  type: "stage";
  apiId: string;
  apiName: string;
  stageName: string;
  invokeUrl: string;
}

export interface AGWResourceMeta extends Record<string, unknown> {
  type: "resource";
  apiId: string;
  apiName: string;
  stageName: string;
  resourceId: string;
  resourcePath: string;
  httpMethod?: string;
}

export type ApiGatewayRowMeta = AGWApiMeta | AGWStageMeta | AGWResourceMeta;

export interface AwsRestApi {
  id: string;
  name: string;
  description?: string;
  createdDate?: string;
  endpointConfiguration?: { types: string[] };
}

export interface AwsStage {
  stageName: string;
  description?: string;
  deploymentId?: string;
  createdDate?: string;
  lastUpdatedDate?: string;
}

export interface AwsResource {
  id: string;
  path: string;
  pathPart?: string;
  resourceMethods?: Record<string, unknown>;
}
