import { S3ServiceAdapter } from './views/s3/adapter.js';
import { Route53ServiceAdapter } from './views/route53/adapter.js';
import { DynamoDBServiceAdapter } from './views/dynamodb/adapter.js';

export const SERVICE_REGISTRY = {
  s3: (endpointUrl?: string) => new S3ServiceAdapter(endpointUrl),
  route53: (endpointUrl?: string) => new Route53ServiceAdapter(),
  dynamodb: (endpointUrl?: string) => new DynamoDBServiceAdapter(),
} as const;

export type ServiceId = keyof typeof SERVICE_REGISTRY;
