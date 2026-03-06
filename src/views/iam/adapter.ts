import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";
import type {
  ServiceAdapter,
  DetailField,
} from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";

type IamLevel =
  | { kind: "root" }
  | { kind: "roles" }
  | { kind: "role-menu"; roleName: string }
  | { kind: "role-inline-policies"; roleName: string }
  | { kind: "role-attached-policies"; roleName: string }
  | { kind: "policies" };

interface IamNavFrame extends NavFrame {
  level: IamLevel;
}

interface AwsRole {
  RoleName: string;
  Arn: string;
  Path?: string;
  Description?: string;
  MaxSessionDuration?: number;
  CreateDate?: string;
  AssumeRolePolicyDocument?: unknown;
  RoleLastUsed?: { LastUsedDate?: string; Region?: string };
}

interface AwsManagedPolicy {
  PolicyName: string;
  Arn: string;
  Path?: string;
  Description?: string;
  DefaultVersionId?: string;
  AttachmentCount?: number;
  UpdateDate?: string;
  CreateDate?: string;
}

interface AwsAttachedPolicy {
  PolicyName: string;
  PolicyArn: string;
}

function runAwsJson<T>(args: string[]): T {
  try {
    const output = execFileSync("aws", [...args, "--output", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(output) as T;
  } catch (error) {
    const message = (error as Error).message;
    const isIamDisabled =
      message.includes("Service 'iam' is not enabled") ||
      message.includes("when calling the ListRoles operation");
    const usingLocalstack = Boolean(process.env.AWS_ENDPOINT_URL);

    if (isIamDisabled && usingLocalstack) {
      throw new Error(
        "IAM is not enabled in LocalStack. Add iam to SERVICES (for example: SERVICES=s3,iam,sts) and restart LocalStack.",
      );
    }

    throw error;
  }
}

function safeString(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function formatDate(value: string | undefined): string {
  if (!value) return "-";
  return value.replace("T", " ").replace("Z", "");
}

async function writeTempJsonFile(prefix: string, payload: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "a9s-iam-"));
  const filePath = join(dir, `${prefix}.json`);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

export class IamServiceAdapter implements ServiceAdapter {
  id = "iam";
  label = "IAM";
  hudColor = { bg: "magenta", fg: "white" };

  private level: IamLevel = { kind: "root" };
  private backStack: IamNavFrame[] = [];

  getColumns(): ColumnDef[] {
    switch (this.level.kind) {
      case "root":
      case "role-menu":
        return [
          { key: "name", label: "Name" },
          { key: "type", label: "Type", width: 24 },
        ];
      case "roles":
        return [
          { key: "name", label: "Role Name" },
          { key: "type", label: "Type", width: 14 },
          { key: "created", label: "Created", width: 22 },
        ];
      case "role-inline-policies":
      case "role-attached-policies":
      case "policies":
        return [
          { key: "name", label: "Policy Name" },
          { key: "type", label: "Type", width: 24 },
          { key: "scope", label: "Scope", width: 12 },
        ];
    }
  }

  async getRows(): Promise<TableRow[]> {
    switch (this.level.kind) {
      case "root":
        return [
          {
            id: "roles",
            cells: { name: "Roles", type: "IAM Role List" },
            meta: { type: "menu", kind: "roles" },
          },
          {
            id: "policies",
            cells: { name: "Policies", type: "Managed Policy List" },
            meta: { type: "menu", kind: "policies" },
          },
        ];
      case "roles": {
        const data = runAwsJson<{ Roles?: AwsRole[] }>(["iam", "list-roles"]);
        return (data.Roles ?? []).map((role) => ({
          id: role.RoleName,
          cells: {
            name: role.RoleName,
            type: "Role",
            created: formatDate(role.CreateDate),
          },
          meta: { type: "role", roleName: role.RoleName, arn: role.Arn },
        }));
      }
      case "role-menu":
        return [
          {
            id: `${this.level.roleName}::inline`,
            cells: { name: "Inline Policies", type: "Role Inline Policies" },
            meta: {
              type: "menu",
              kind: "role-inline-policies",
              roleName: this.level.roleName,
            },
          },
          {
            id: `${this.level.roleName}::attached`,
            cells: { name: "Attached Policies", type: "Role Attached Policies" },
            meta: {
              type: "menu",
              kind: "role-attached-policies",
              roleName: this.level.roleName,
            },
          },
        ];
      case "role-inline-policies": {
        const { roleName } = this.level;
        const data = runAwsJson<{ PolicyNames?: string[] }>([
          "iam",
          "list-role-policies",
          "--role-name",
          roleName,
        ]);
        return (data.PolicyNames ?? []).map((policyName) => ({
          id: `${roleName}::inline::${policyName}`,
          cells: {
            name: policyName,
            type: "Inline Policy",
            scope: "Role",
          },
          meta: {
            type: "inline-policy",
            roleName,
            policyName,
          },
        }));
      }
      case "role-attached-policies": {
        const { roleName } = this.level;
        const data = runAwsJson<{ AttachedPolicies?: AwsAttachedPolicy[] }>([
          "iam",
          "list-attached-role-policies",
          "--role-name",
          roleName,
        ]);
        return (data.AttachedPolicies ?? []).map((policy) => ({
          id: policy.PolicyArn,
          cells: {
            name: policy.PolicyName,
            type: "Attached Policy",
            scope: "Managed",
          },
          meta: {
            type: "managed-policy",
            policyArn: policy.PolicyArn,
            policyName: policy.PolicyName,
          },
        }));
      }
      case "policies": {
        const data = runAwsJson<{ Policies?: AwsManagedPolicy[] }>([
          "iam",
          "list-policies",
          "--scope",
          "Local",
        ]);
        return (data.Policies ?? []).map((policy) => ({
          id: policy.Arn,
          cells: {
            name: policy.PolicyName,
            type: "Managed Policy",
            scope: "Account",
          },
          meta: {
            type: "managed-policy",
            policyArn: policy.Arn,
            policyName: policy.PolicyName,
          },
        }));
      }
    }
  }

  async onSelect(row: TableRow): Promise<SelectResult> {
    const backStack = [...this.backStack, { level: this.level, selectedIndex: 0 }];
    const kind = row.meta?.kind as string | undefined;

    if (this.level.kind === "root" && kind === "roles") {
      this.backStack = backStack;
      this.level = { kind: "roles" };
      return { action: "navigate" };
    }
    if (this.level.kind === "root" && kind === "policies") {
      this.backStack = backStack;
      this.level = { kind: "policies" };
      return { action: "navigate" };
    }

    if (this.level.kind === "roles" && (row.meta?.type as string) === "role") {
      this.backStack = backStack;
      this.level = { kind: "role-menu", roleName: row.id };
      return { action: "navigate" };
    }

    if (this.level.kind === "role-menu" && kind === "role-inline-policies") {
      this.backStack = backStack;
      this.level = { kind: "role-inline-policies", roleName: this.level.roleName };
      return { action: "navigate" };
    }

    if (this.level.kind === "role-menu" && kind === "role-attached-policies") {
      this.backStack = backStack;
      this.level = { kind: "role-attached-policies", roleName: this.level.roleName };
      return { action: "navigate" };
    }

    return { action: "none" };
  }

  async onEdit(row: TableRow): Promise<SelectResult> {
    const type = row.meta?.type as string | undefined;

    if (type === "role") {
      const roleName = row.meta?.roleName as string;
      const roleData = runAwsJson<{ Role: AwsRole }>([
        "iam",
        "get-role",
        "--role-name",
        roleName,
      ]);
      const trust = roleData.Role.AssumeRolePolicyDocument ?? {};
      const filePath = await writeTempJsonFile(
        `${roleName}-trust-policy`,
        trust,
      );
      return { action: "edit", filePath, metadata: {} };
    }

    if (type === "inline-policy") {
      const roleName = row.meta?.roleName as string;
      const policyName = row.meta?.policyName as string;
      const data = runAwsJson<{ PolicyDocument?: unknown }>([
        "iam",
        "get-role-policy",
        "--role-name",
        roleName,
        "--policy-name",
        policyName,
      ]);
      const filePath = await writeTempJsonFile(
        `${roleName}-${policyName}-inline-policy`,
        data.PolicyDocument ?? {},
      );
      return { action: "edit", filePath, metadata: {} };
    }

    if (type === "managed-policy") {
      const policyArn = row.meta?.policyArn as string;
      const policyMeta = runAwsJson<{ Policy: AwsManagedPolicy }>([
        "iam",
        "get-policy",
        "--policy-arn",
        policyArn,
      ]);
      const versionId = policyMeta.Policy.DefaultVersionId;
      if (!versionId) return { action: "none" };
      const policyVersion = runAwsJson<{ PolicyVersion?: { Document?: unknown } }>([
        "iam",
        "get-policy-version",
        "--policy-arn",
        policyArn,
        "--version-id",
        versionId,
      ]);
      const filePath = await writeTempJsonFile(
        `${(row.meta?.policyName as string) || "policy"}-${versionId}`,
        policyVersion.PolicyVersion?.Document ?? {},
      );
      return { action: "edit", filePath, metadata: {} };
    }

    return { action: "none" };
  }

  canGoBack(): boolean {
    return this.backStack.length > 0;
  }

  goBack(): void {
    const frame = this.backStack.pop();
    if (!frame) return;
    this.level = frame.level;
  }

  getPath(): string {
    switch (this.level.kind) {
      case "root":
        return "iam://";
      case "roles":
        return "iam://roles";
      case "role-menu":
        return `iam://roles/${this.level.roleName}`;
      case "role-inline-policies":
        return `iam://roles/${this.level.roleName}/inline-policies`;
      case "role-attached-policies":
        return `iam://roles/${this.level.roleName}/attached-policies`;
      case "policies":
        return "iam://policies";
    }
  }

  getContextLabel(): string {
    switch (this.level.kind) {
      case "root":
        return "🔐 IAM Resources";
      case "roles":
        return "👤 IAM Roles";
      case "role-menu":
        return `👤 Role: ${this.level.roleName}`;
      case "role-inline-policies":
        return `📄 Inline Policies (${this.level.roleName})`;
      case "role-attached-policies":
        return `📎 Attached Policies (${this.level.roleName})`;
      case "policies":
        return "📚 Managed Policies";
    }
  }

  async getDetails(row: TableRow): Promise<DetailField[]> {
    const type = row.meta?.type as string | undefined;

    if (type === "role") {
      const roleName = row.meta?.roleName as string;
      const data = runAwsJson<{ Role: AwsRole }>([
        "iam",
        "get-role",
        "--role-name",
        roleName,
      ]);
      const role = data.Role;
      return [
        { label: "Name", value: role.RoleName },
        { label: "Type", value: "Role" },
        { label: "ARN", value: role.Arn },
        { label: "Path", value: role.Path ?? "/" },
        { label: "Created", value: formatDate(role.CreateDate) },
        {
          label: "Max Session Duration",
          value: role.MaxSessionDuration
            ? `${role.MaxSessionDuration} sec`
            : "-",
        },
        { label: "Description", value: role.Description ?? "-" },
        {
          label: "Last Used",
          value: formatDate(role.RoleLastUsed?.LastUsedDate),
        },
        {
          label: "Last Used Region",
          value: role.RoleLastUsed?.Region ?? "-",
        },
      ];
    }

    if (type === "inline-policy") {
      const roleName = row.meta?.roleName as string;
      const policyName = row.meta?.policyName as string;
      const data = runAwsJson<{ PolicyDocument?: unknown }>([
        "iam",
        "get-role-policy",
        "--role-name",
        roleName,
        "--policy-name",
        policyName,
      ]);
      return [
        { label: "Name", value: policyName },
        { label: "Type", value: "Inline Policy" },
        { label: "Role", value: roleName },
        { label: "Statements", value: safeString((data.PolicyDocument as any)?.Statement?.length ?? "-") },
      ];
    }

    if (type === "managed-policy") {
      const policyArn = row.meta?.policyArn as string;
      const data = runAwsJson<{ Policy: AwsManagedPolicy }>([
        "iam",
        "get-policy",
        "--policy-arn",
        policyArn,
      ]);
      const p = data.Policy;
      return [
        { label: "Name", value: p.PolicyName },
        { label: "Type", value: "Managed Policy" },
        { label: "ARN", value: p.Arn },
        { label: "Path", value: p.Path ?? "/" },
        { label: "Description", value: p.Description ?? "-" },
        {
          label: "Default Version",
          value: p.DefaultVersionId ?? "-",
        },
        {
          label: "Attachment Count",
          value: p.AttachmentCount !== undefined ? String(p.AttachmentCount) : "-",
        },
        { label: "Created", value: formatDate(p.CreateDate) },
        { label: "Updated", value: formatDate(p.UpdateDate) },
      ];
    }

    const label = row.cells.name ?? row.id;
    return [
      { label: "Name", value: label },
      { label: "Type", value: safeString(type ?? "Item") },
    ];
  }
}
