import { runAwsJsonAsync } from "../../utils/aws.js";
import { buildRegionArgs } from "../../utils/aws.js";
import type { AwsSecret, AwsSecretValue } from "./types.js";

export async function getSecretValue(secretId: string, region?: string): Promise<AwsSecretValue> {
  return runAwsJsonAsync<AwsSecretValue>([
    "secretsmanager",
    "get-secret-value",
    "--secret-id",
    secretId,
    ...buildRegionArgs(region),
  ]);
}

export async function describeSecret(secretId: string, region?: string): Promise<AwsSecret> {
  return runAwsJsonAsync<AwsSecret>([
    "secretsmanager",
    "describe-secret",
    "--secret-id",
    secretId,
    ...buildRegionArgs(region),
  ]);
}

export async function putSecretValue(
  secretId: string,
  value: string,
  region?: string,
): Promise<void> {
  await runAwsJsonAsync([
    "secretsmanager",
    "put-secret-value",
    "--secret-id",
    secretId,
    "--secret-string",
    value,
    ...buildRegionArgs(region),
  ]);
}
