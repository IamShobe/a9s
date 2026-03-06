import { createS3ServiceAdapter } from "./views/s3/adapter.js";
import { createRoute53ServiceAdapter } from "./views/route53/adapter.js";
import { createDynamoDBServiceAdapter } from "./views/dynamodb/adapter.js";
import { createIamServiceAdapter } from "./views/iam/adapter.js";
import { createSecretsManagerServiceAdapter } from "./views/secretsmanager/adapter.js";

export const SERVICE_REGISTRY = {
  s3: (endpointUrl?: string, region?: string) => createS3ServiceAdapter(endpointUrl, region),
  route53: (_endpointUrl?: string, _region?: string) => createRoute53ServiceAdapter(),
  dynamodb: (_endpointUrl?: string, _region?: string) => createDynamoDBServiceAdapter(),
  iam: (_endpointUrl?: string, _region?: string) => createIamServiceAdapter(),
  secretsmanager: (endpointUrl?: string, region?: string) =>
    createSecretsManagerServiceAdapter(endpointUrl, region),
} as const;

export type ServiceId = keyof typeof SERVICE_REGISTRY;
