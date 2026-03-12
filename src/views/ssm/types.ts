export type SSMLevel =
  | { kind: "parameters" }
  | { kind: "history"; parameterName: string };

export interface SSMParameterMeta extends Record<string, unknown> {
  type: "parameter";
  parameterName: string;
  parameterType: string;
  parameterArn: string;
}

export interface SSMHistoryMeta extends Record<string, unknown> {
  type: "history";
  parameterName: string;
  version: number;
  parameterType: string;
}

export type SSMRowMeta = SSMParameterMeta | SSMHistoryMeta;

export interface AwsSSMParameter {
  Name: string;
  Type: string;
  ARN?: string;
  Version?: number;
  LastModifiedDate?: string;
  LastModifiedUser?: string;
  Description?: string;
  DataType?: string;
}

export interface AwsSSMParameterHistory {
  Name: string;
  Type: string;
  Version: number;
  LastModifiedDate?: string;
  LastModifiedUser?: string;
  Description?: string;
  Value?: string;
}
