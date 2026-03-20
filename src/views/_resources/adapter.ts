import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult } from "../../types.js";
import { textCell } from "../../types.js";
import { singlePartKey } from "../../utils/bookmarks.js";
import { SERVICE_REGISTRY } from "../../services.js";
import type { AwsServiceId } from "../../services.js";
import { SERVICE_COLORS } from "../../constants/theme.js";

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  s3: "Simple Storage Service",
  route53: "DNS Web Service",
  dynamodb: "NoSQL Database",
  iam: "Identity & Access Management",
  secretsmanager: "Secrets Manager",
  ec2: "Elastic Compute Cloud",
  lambda: "Serverless Functions",
  ecs: "Elastic Container Service",
  cloudwatch: "Monitoring & Observability",
  ebs: "Elastic Block Store",
  elb: "Elastic Load Balancing",
  rds: "Relational Database Service",
  sqs: "Simple Queue Service",
  cloudformation: "Infrastructure as Code",
  sns: "Simple Notification Service",
  ssm: "Systems Manager",
  vpc: "Virtual Private Cloud",
  ecr: "Elastic Container Registry",
  stepfunctions: "Step Functions",
  eventbridge: "EventBridge",
  apigateway: "API Gateway",
};

export function createResourceAdapter(): ServiceAdapter {
  return {
    id: "_resources",
    label: "Resources",
    hudColor: SERVICE_COLORS._resources ?? { bg: "white", fg: "black" },

    getColumns(): ColumnDef[] {
      return [
        { key: "resource", label: "Service" },
        { key: "description", label: "Description" },
      ];
    },

    async getRows(): Promise<TableRow[]> {
      return (Object.keys(SERVICE_REGISTRY) as AwsServiceId[]).map((serviceId) => ({
        id: serviceId,
        cells: {
          resource: textCell(serviceId),
          description: textCell(SERVICE_DESCRIPTIONS[serviceId] ?? `${serviceId.toUpperCase()} service`),
        },
        meta: {},
      }));
    },

    async onSelect(_row: TableRow): Promise<SelectResult> {
      return { action: "none" };
    },

    canGoBack(): boolean {
      return false;
    },

    goBack(): undefined {
      return undefined;
    },

    pushUiLevel(_filterText: string, _selectedIndex: number): void {
      // Single-level adapter — never called
    },

    getPath(): string {
      return "resources";
    },
    getBookmarkKey(row: TableRow) {
      return singlePartKey("Resource", row);
    },
  };
}
