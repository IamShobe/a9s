import { createS3ServiceAdapter } from "./views/s3/adapter.js";
import { createRoute53ServiceAdapter } from "./views/route53/adapter.js";
import { createDynamoDBServiceAdapter } from "./views/dynamodb/adapter.js";
import { createIamServiceAdapter } from "./views/iam/adapter.js";
import { createSecretsManagerServiceAdapter } from "./views/secretsmanager/adapter.js";
import { createEC2ServiceAdapter } from "./views/ec2/adapter.js";
import { createLambdaServiceAdapter } from "./views/lambda/adapter.js";
import { createECSServiceAdapter } from "./views/ecs/adapter.js";
import { createCloudWatchServiceAdapter } from "./views/cloudwatch/adapter.js";
import { createEBSServiceAdapter } from "./views/ebs/adapter.js";
import { createELBServiceAdapter } from "./views/elb/adapter.js";
import { createRDSServiceAdapter } from "./views/rds/adapter.js";
import { createSQSServiceAdapter } from "./views/sqs/adapter.js";
import { createCloudFormationServiceAdapter } from "./views/cloudformation/adapter.js";
import { createSNSServiceAdapter } from "./views/sns/adapter.js";
import { createSSMServiceAdapter } from "./views/ssm/adapter.js";
import { createVPCServiceAdapter } from "./views/vpc/adapter.js";
import { createECRServiceAdapter } from "./views/ecr/adapter.js";
import { createStepFunctionsServiceAdapter } from "./views/stepfunctions/adapter.js";

export const SERVICE_REGISTRY = {
  s3: (endpointUrl?: string, region?: string) => createS3ServiceAdapter(endpointUrl, region),
  // Note: Route53 and DynamoDB don't yet support LocalStack; endpointUrl is intentionally ignored.
  route53: (_endpointUrl?: string, region?: string) => createRoute53ServiceAdapter(undefined, region),
  dynamodb: (_endpointUrl?: string, region?: string) => createDynamoDBServiceAdapter(undefined, region),
  iam: (_endpointUrl?: string, _region?: string) => createIamServiceAdapter(),
  secretsmanager: (endpointUrl?: string, region?: string) =>
    createSecretsManagerServiceAdapter(endpointUrl, region),
  ec2: (_endpointUrl?: string, region?: string) => createEC2ServiceAdapter(undefined, region),
  lambda: (_endpointUrl?: string, region?: string) => createLambdaServiceAdapter(undefined, region),
  ecs: (_endpointUrl?: string, region?: string) => createECSServiceAdapter(undefined, region),
  cloudwatch: (_endpointUrl?: string, region?: string) =>
    createCloudWatchServiceAdapter(undefined, region),
  ebs: (_endpointUrl?: string, region?: string) => createEBSServiceAdapter(undefined, region),
  elb: (_endpointUrl?: string, region?: string) => createELBServiceAdapter(undefined, region),
  // Note: RDS is not supported by LocalStack Community; use against real AWS or LocalStack Pro.
  rds: (_endpointUrl?: string, region?: string) => createRDSServiceAdapter(undefined, region),
  sqs: (endpointUrl?: string, region?: string) => createSQSServiceAdapter(endpointUrl, region),
  cloudformation: (endpointUrl?: string, region?: string) => createCloudFormationServiceAdapter(endpointUrl, region),
  sns: (_endpointUrl?: string, region?: string) => createSNSServiceAdapter(undefined, region),
  ssm: (_endpointUrl?: string, region?: string) => createSSMServiceAdapter(undefined, region),
  vpc: (_endpointUrl?: string, region?: string) => createVPCServiceAdapter(undefined, region),
  ecr: (_endpointUrl?: string, region?: string) => createECRServiceAdapter(undefined, region),
  stepfunctions: (_endpointUrl?: string, region?: string) =>
    createStepFunctionsServiceAdapter(undefined, region),
} as const;

export type ServiceId = keyof typeof SERVICE_REGISTRY;
