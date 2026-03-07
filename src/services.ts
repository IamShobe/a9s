import { createS3ServiceAdapter } from "./views/s3/adapter.js";
import { createRoute53ServiceAdapter } from "./views/route53/adapter.js";
import { createDynamoDBServiceAdapter } from "./views/dynamodb/adapter.js";
import { createIamServiceAdapter } from "./views/iam/adapter.js";
import { createSecretsManagerServiceAdapter } from "./views/secretsmanager/adapter.js";

export const SERVICE_REGISTRY = {
  s3: (endpointUrl?: string, region?: string) => createS3ServiceAdapter(endpointUrl, region),
  // Note: Route53 and DynamoDB don't yet support LocalStack; endpointUrl is intentionally ignored.
  route53: (_endpointUrl?: string, region?: string) => createRoute53ServiceAdapter(undefined, region),
  dynamodb: (_endpointUrl?: string, region?: string) => createDynamoDBServiceAdapter(undefined, region),
  iam: (_endpointUrl?: string, _region?: string) => createIamServiceAdapter(),
  secretsmanager: (endpointUrl?: string, region?: string) =>
    createSecretsManagerServiceAdapter(endpointUrl, region),
} as const;

export type ServiceId = keyof typeof SERVICE_REGISTRY;
