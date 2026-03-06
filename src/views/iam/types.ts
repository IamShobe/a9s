import type { NavFrame } from "../../types.js";

export type IamLevel =
  | { kind: "root" }
  | { kind: "roles" }
  | { kind: "role-menu"; roleName: string }
  | { kind: "role-inline-policies"; roleName: string }
  | { kind: "role-attached-policies"; roleName: string }
  | { kind: "policies" };

export interface IamNavFrame extends NavFrame {
  level: IamLevel;
}

export interface AwsRole {
  RoleName: string;
  Arn: string;
  Path?: string;
  Description?: string;
  MaxSessionDuration?: number;
  CreateDate?: string;
  AssumeRolePolicyDocument?: unknown;
  RoleLastUsed?: { LastUsedDate?: string; Region?: string };
}

export interface AwsManagedPolicy {
  PolicyName: string;
  Arn: string;
  Path?: string;
  Description?: string;
  DefaultVersionId?: string;
  AttachmentCount?: number;
  UpdateDate?: string;
  CreateDate?: string;
}

export interface AwsAttachedPolicy {
  PolicyName: string;
  PolicyArn: string;
}

export type IamRowMeta =
  | { type: "menu"; kind: string; roleName?: string }
  | { type: "role"; roleName: string; arn: string }
  | { type: "inline-policy"; roleName: string; policyName: string }
  | { type: "managed-policy"; policyArn: string; policyName: string };
