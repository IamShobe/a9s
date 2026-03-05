import { S3ServiceAdapter } from "./views/s3/adapter.js";
import { Route53ServiceAdapter } from "./views/route53/adapter.js";
import { DynamoDBServiceAdapter } from "./views/dynamodb/adapter.js";
export const SERVICE_REGISTRY = {
  s3: (
    endpointUrl?: string,
    region?: string,
    getLevel?: () => any,
    setLevel?: (level: any) => void,
    getBackStack?: () => any,
    setBackStack?: (stack: any) => void,
  ) => {
    if (getLevel && setLevel && getBackStack && setBackStack) {
      return new S3ServiceAdapter(
        endpointUrl,
        region,
        getLevel,
        setLevel,
        getBackStack,
        setBackStack,
      );
    }
    return new S3ServiceAdapter(
      endpointUrl,
      region,
      () => ({ kind: "buckets" }),
      () => {},
      () => [],
      () => {},
    );
  },
  route53: (endpointUrl?: string, region?: string) =>
    new Route53ServiceAdapter(),
  dynamodb: (endpointUrl?: string, region?: string) =>
    new DynamoDBServiceAdapter(),
} as const;

export type ServiceId = keyof typeof SERVICE_REGISTRY;
