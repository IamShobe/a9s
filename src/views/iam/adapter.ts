import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import { runAwsJsonAsync } from "../../utils/aws.js";
import type { ColumnDef, TableRow, SelectResult } from "../../types.js";
import { textCell } from "../../types.js";
import type {
  IamLevel,
  IamNavFrame,
  AwsRole,
  AwsManagedPolicy,
  AwsAttachedPolicy,
  IamRowMeta,
} from "./types.js";
import { formatDate } from "./utils.js";
import { createIamEditCapability } from "./capabilities/editCapability.js";
import { createIamDetailCapability } from "./capabilities/detailCapability.js";
import { createIamYankCapability } from "./capabilities/yankCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";

function getIamMeta(row: TableRow): IamRowMeta | undefined {
  return row.meta as IamRowMeta | undefined;
}

export function createIamServiceAdapter(): ServiceAdapter {
  let level: IamLevel = { kind: "root" };
  let backStack: IamNavFrame[] = [];

  const getLevel = () => level;
  const setLevel = (newLevel: IamLevel) => {
    level = newLevel;
  };
  const getBackStack = () => backStack;
  const setBackStack = (newStack: IamNavFrame[]) => {
    backStack = newStack;
  };

  const getColumns = (): ColumnDef[] => {
    switch (level.kind) {
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
  };

  const getRows = async (): Promise<TableRow[]> => {
    switch (level.kind) {
      case "root":
        return [
          {
            id: "roles",
            cells: { name: textCell("Roles"), type: textCell("IAM Role List") },
            meta: { type: "menu", kind: "roles" },
          },
          {
            id: "policies",
            cells: { name: textCell("Policies"), type: textCell("Managed Policy List") },
            meta: { type: "menu", kind: "policies" },
          },
        ];
      case "roles": {
        const data = await runAwsJsonAsync<{ Roles?: AwsRole[] }>(["iam", "list-roles"]);
        return (data.Roles ?? []).map((role) => ({
          id: role.RoleName,
          cells: {
            name: textCell(role.RoleName),
            type: textCell("Role"),
            created: textCell(formatDate(role.CreateDate)),
          },
          meta: { type: "role", roleName: role.RoleName, arn: role.Arn },
        }));
      }
      case "role-menu":
        return [
          {
            id: `${level.roleName}::inline`,
            cells: { name: textCell("Inline Policies"), type: textCell("Role Inline Policies") },
            meta: {
              type: "menu",
              kind: "role-inline-policies",
              roleName: level.roleName,
            },
          },
          {
            id: `${level.roleName}::attached`,
            cells: {
              name: textCell("Attached Policies"),
              type: textCell("Role Attached Policies"),
            },
            meta: {
              type: "menu",
              kind: "role-attached-policies",
              roleName: level.roleName,
            },
          },
        ];
      case "role-inline-policies": {
        const { roleName } = level;
        const data = await runAwsJsonAsync<{ PolicyNames?: string[] }>([
          "iam",
          "list-role-policies",
          "--role-name",
          roleName,
        ]);
        return (data.PolicyNames ?? []).map((policyName) => ({
          id: `${roleName}::inline::${policyName}`,
          cells: {
            name: textCell(policyName),
            type: textCell("Inline Policy"),
            scope: textCell("Role"),
          },
          meta: {
            type: "inline-policy",
            roleName,
            policyName,
          },
        }));
      }
      case "role-attached-policies": {
        const { roleName } = level;
        const data = await runAwsJsonAsync<{ AttachedPolicies?: AwsAttachedPolicy[] }>([
          "iam",
          "list-attached-role-policies",
          "--role-name",
          roleName,
        ]);
        return (data.AttachedPolicies ?? []).map((policy) => ({
          id: policy.PolicyArn,
          cells: {
            name: textCell(policy.PolicyName),
            type: textCell("Attached Policy"),
            scope: textCell("Managed"),
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
            name: textCell(policy.PolicyName),
            type: textCell("Managed Policy"),
            scope: textCell("Account"),
          },
          meta: {
            type: "managed-policy",
            policyArn: policy.Arn,
            policyName: policy.PolicyName,
          },
        }));
      }
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const nextBackStack = [...backStack, { level, selectedIndex: 0 }];
    const meta = getIamMeta(row);

    if (level.kind === "root" && meta?.type === "menu" && meta.kind === "roles") {
      setBackStack(nextBackStack);
      setLevel({ kind: "roles" });
      return { action: "navigate" };
    }
    if (level.kind === "root" && meta?.type === "menu" && meta.kind === "policies") {
      setBackStack(nextBackStack);
      setLevel({ kind: "policies" });
      return { action: "navigate" };
    }

    if (level.kind === "roles" && meta?.type === "role") {
      setBackStack(nextBackStack);
      setLevel({ kind: "role-menu", roleName: row.id });
      return { action: "navigate" };
    }

    if (
      level.kind === "role-menu" &&
      meta?.type === "menu" &&
      meta.kind === "role-inline-policies"
    ) {
      setBackStack(nextBackStack);
      setLevel({ kind: "role-inline-policies", roleName: level.roleName });
      return { action: "navigate" };
    }

    if (
      level.kind === "role-menu" &&
      meta?.type === "menu" &&
      meta.kind === "role-attached-policies"
    ) {
      setBackStack(nextBackStack);
      setLevel({ kind: "role-attached-policies", roleName: level.roleName });
      return { action: "navigate" };
    }

    return { action: "none" };
  };

  const canGoBack = (): boolean => getBackStack().length > 0;

  const goBack = (): void => {
    const frame = getBackStack()[getBackStack().length - 1];
    if (!frame) return;
    setBackStack(getBackStack().slice(0, -1));
    setLevel(frame.level);
  };

  const getPath = (): string => {
    switch (level.kind) {
      case "root":
        return "iam://";
      case "roles":
        return "iam://roles";
      case "role-menu":
        return `iam://roles/${level.roleName}`;
      case "role-inline-policies":
        return `iam://roles/${level.roleName}/inline-policies`;
      case "role-attached-policies":
        return `iam://roles/${level.roleName}/attached-policies`;
      case "policies":
        return "iam://policies";
    }
  };

  const getContextLabel = (): string => {
    switch (level.kind) {
      case "root":
        return "🔐 IAM Resources";
      case "roles":
        return "👤 IAM Roles";
      case "role-menu":
        return `👤 Role: ${level.roleName}`;
      case "role-inline-policies":
        return `📄 Inline Policies (${level.roleName})`;
      case "role-attached-policies":
        return `📎 Attached Policies (${level.roleName})`;
      case "policies":
        return "📚 Managed Policies";
    }
  };

  // Compose capabilities
  const editCapability = createIamEditCapability(getLevel);
  const detailCapability = createIamDetailCapability(getLevel);
  const yankCapability = createIamYankCapability();

  return {
    id: "iam",
    label: "IAM",
    hudColor: SERVICE_COLORS.iam,
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    capabilities: {
      edit: editCapability,
      detail: detailCapability,
      yank: yankCapability,
    },
  };
}
