import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";
import type {
  ServiceAdapter,
  DetailField,
  YankOption,
} from "../../adapters/ServiceAdapter.js";
import { runAwsJsonAsync } from "../../utils/aws.js";
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

type IamRowMeta =
  | { type: "menu"; kind: string; roleName?: string }
  | { type: "role"; roleName: string; arn: string }
  | { type: "inline-policy"; roleName: string; policyName: string }
  | { type: "managed-policy"; policyArn: string; policyName: string };

function getIamMeta(row: TableRow): IamRowMeta | undefined {
  return row.meta as IamRowMeta | undefined;
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
        const data = await runAwsJsonAsync<{ Roles?: AwsRole[] }>([
          "iam",
          "list-roles",
        ]);
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
        const data = await runAwsJsonAsync<{ PolicyNames?: string[] }>([
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
        const data = await runAwsJsonAsync<{ AttachedPolicies?: AwsAttachedPolicy[] }>([
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
        const data = await runAwsJsonAsync<{ Policies?: AwsManagedPolicy[] }>([
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
    const meta = getIamMeta(row);

    if (this.level.kind === "root" && meta?.type === "menu" && meta.kind === "roles") {
      this.backStack = backStack;
      this.level = { kind: "roles" };
      return { action: "navigate" };
    }
    if (this.level.kind === "root" && meta?.type === "menu" && meta.kind === "policies") {
      this.backStack = backStack;
      this.level = { kind: "policies" };
      return { action: "navigate" };
    }

    if (this.level.kind === "roles" && meta?.type === "role") {
      this.backStack = backStack;
      this.level = { kind: "role-menu", roleName: row.id };
      return { action: "navigate" };
    }

    if (this.level.kind === "role-menu" && meta?.type === "menu" && meta.kind === "role-inline-policies") {
      this.backStack = backStack;
      this.level = { kind: "role-inline-policies", roleName: this.level.roleName };
      return { action: "navigate" };
    }

    if (this.level.kind === "role-menu" && meta?.type === "menu" && meta.kind === "role-attached-policies") {
      this.backStack = backStack;
      this.level = { kind: "role-attached-policies", roleName: this.level.roleName };
      return { action: "navigate" };
    }

    return { action: "none" };
  }

  async onEdit(row: TableRow): Promise<SelectResult> {
    const meta = getIamMeta(row);

    if (meta?.type === "role") {
      const roleName = meta.roleName;
      const roleData = await runAwsJsonAsync<{ Role: AwsRole }>([
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

    if (meta?.type === "inline-policy") {
      const { roleName, policyName } = meta;
      const data = await runAwsJsonAsync<{ PolicyDocument?: unknown }>([
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

    if (meta?.type === "managed-policy") {
      const { policyArn, policyName } = meta;
      const policyMeta = await runAwsJsonAsync<{ Policy: AwsManagedPolicy }>([
        "iam",
        "get-policy",
        "--policy-arn",
        policyArn,
      ]);
      const versionId = policyMeta.Policy.DefaultVersionId;
      if (!versionId) return { action: "none" };
      const policyVersion = await runAwsJsonAsync<{
        PolicyVersion?: { Document?: unknown };
      }>([
        "iam",
        "get-policy-version",
        "--policy-arn",
        policyArn,
        "--version-id",
        versionId,
      ]);
      const filePath = await writeTempJsonFile(
        `${policyName || "policy"}-${versionId}`,
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

  getYankOptions(row: TableRow): YankOption[] {
    const meta = getIamMeta(row);
    if (meta?.type === "role" || meta?.type === "managed-policy") {
      return [{ key: "a", label: "copy arn", feedback: "Copied ARN" }];
    }
    return [];
  }

  async getClipboardValue(row: TableRow, yankKey: string): Promise<string | null> {
    const meta = getIamMeta(row);
    if (yankKey === "a") {
      if (meta?.type === "role") return meta.arn;
      if (meta?.type === "managed-policy") return meta.policyArn;
    }
    return null;
  }

  async getDetails(row: TableRow): Promise<DetailField[]> {
    const meta = getIamMeta(row);

    if (meta?.type === "role") {
      const roleName = meta.roleName;
      const data = await runAwsJsonAsync<{ Role: AwsRole }>([
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

    if (meta?.type === "inline-policy") {
      const { roleName, policyName } = meta;
      const data = await runAwsJsonAsync<{ PolicyDocument?: unknown }>([
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
        { label: "Statements", value: safeString((data.PolicyDocument as Record<string, unknown>)?.["Statement"] as unknown) },
      ];
    }

    if (meta?.type === "managed-policy") {
      const { policyArn } = meta;
      const data = await runAwsJsonAsync<{ Policy: AwsManagedPolicy }>([
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
        { label: "Default Version", value: p.DefaultVersionId ?? "-" },
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
      { label: "Type", value: safeString(meta?.type ?? "Item") },
    ];
  }
}
