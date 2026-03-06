export interface AwsSecret {
  Name: string;
  ARN: string;
  Description?: string;
  LastChangedDate?: string;
  LastRotatedDate?: string;
  RotationEnabled?: boolean;
  KmsKeyId?: string;
  Tags?: Array<{ Key: string; Value: string }>;
}

export interface AwsSecretValue {
  Name: string;
  ARN: string;
  SecretString?: string;
  SecretBinary?: string;
  VersionId?: string;
}

export type SecretLevel =
  | { kind: "secrets" }
  | { kind: "secret-fields"; secretArn: string; secretName: string };

export interface SecretRowMeta extends Record<string, unknown> {
  type: "secret" | "secret-field";
  name?: string;
  arn?: string;
  description?: string;
  key?: string;
  value?: string;
  secretArn?: string;
  secretName?: string;
}

export interface SecretFieldRowMeta extends Record<string, unknown> {
  type: "secret-field";
  key: string;
  value: string;
  secretArn: string;
  secretName: string;
}
