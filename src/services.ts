import { createS3ServiceAdapter } from "./views/s3/adapter.js";
import { createRoute53ServiceAdapter } from "./views/route53/adapter.js";
import { createDynamoDBServiceAdapter } from "./views/dynamodb/adapter.js";
import { createIamServiceAdapter } from "./views/iam/adapter.js";

export const SERVICE_REGISTRY = {
  s3: (endpointUrl?: string, region?: string) =>
    createS3ServiceAdapter(endpointUrl, region),
  route53: (endpointUrl?: string, region?: string) =>
    createRoute53ServiceAdapter(),
  dynamodb: (endpointUrl?: string, region?: string) =>
    createDynamoDBServiceAdapter(),
  iam: (endpointUrl?: string, region?: string) =>
    createIamServiceAdapter(),
} as const;

export type ServiceId = keyof typeof SERVICE_REGISTRY;
