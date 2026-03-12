import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import { statusCell } from "../../utils/statusColors.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../utils/aws.js";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { atom, getDefaultStore } from "jotai";
import type {
  AwsVPC,
  AwsSecurityGroup,
  AwsIpPermission,
  VPCLevel,
  VPCRowMeta,
} from "./types.js";
import { createVPCDetailCapability } from "./capabilities/detailCapability.js";
import { createVPCYankCapability } from "./capabilities/yankCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";

interface VPCNavFrame extends NavFrame {
  level: VPCLevel;
}

export const vpcLevelAtom = atom<VPCLevel>({ kind: "vpcs" });
export const vpcBackStackAtom = atom<VPCNavFrame[]>([]);

function getTagName(tags?: { Key: string; Value: string }[]): string {
  return tags?.find((t) => t.Key === "Name")?.Value ?? "";
}

function formatProtocol(ipProtocol: string): string {
  if (ipProtocol === "-1") return "All";
  return ipProtocol.toUpperCase();
}

function formatPortRange(perm: AwsIpPermission): string {
  if (perm.IpProtocol === "-1") return "All";
  if (perm.FromPort == null) return "All";
  if (perm.FromPort === perm.ToPort) return String(perm.FromPort);
  return `${perm.FromPort}-${perm.ToPort}`;
}

function formatSourceDest(perm: AwsIpPermission): string {
  const parts: string[] = [];
  for (const r of perm.IpRanges ?? []) {
    if (r.CidrIp) parts.push(r.CidrIp);
  }
  for (const r of perm.Ipv6Ranges ?? []) {
    if (r.CidrIpv6) parts.push(r.CidrIpv6);
  }
  for (const g of perm.UserIdGroupPairs ?? []) {
    if (g.GroupId) parts.push(g.GroupId);
  }
  for (const p of perm.PrefixListIds ?? []) {
    if (p.PrefixListId) parts.push(p.PrefixListId);
  }
  return parts.join(", ") || "-";
}

function buildRuleRows(sg: AwsSecurityGroup): TableRow[] {
  const rows: TableRow[] = [];

  for (const perm of sg.IpPermissions ?? []) {
    const portRange = formatPortRange(perm);
    const sourceDest = formatSourceDest(perm);
    const protocol = formatProtocol(perm.IpProtocol);
    rows.push({
      id: `${sg.GroupId}/in/${perm.IpProtocol}/${portRange}/${sourceDest}`,
      cells: {
        direction: textCell("Inbound"),
        protocol: textCell(protocol),
        portRange: textCell(portRange),
        sourceDest: textCell(sourceDest),
      },
      meta: {
        type: "rule",
        direction: "inbound",
        protocol,
        portRange,
        sourceDest,
        sgId: sg.GroupId,
      } satisfies VPCRowMeta,
    });
  }

  for (const perm of sg.IpPermissionsEgress ?? []) {
    const portRange = formatPortRange(perm);
    const sourceDest = formatSourceDest(perm);
    const protocol = formatProtocol(perm.IpProtocol);
    rows.push({
      id: `${sg.GroupId}/out/${perm.IpProtocol}/${portRange}/${sourceDest}`,
      cells: {
        direction: textCell("Outbound"),
        protocol: textCell(protocol),
        portRange: textCell(portRange),
        sourceDest: textCell(sourceDest),
      },
      meta: {
        type: "rule",
        direction: "outbound",
        protocol,
        portRange,
        sourceDest,
        sgId: sg.GroupId,
      } satisfies VPCRowMeta,
    });
  }

  return rows;
}

export function createVPCServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const store = getDefaultStore();
  const regionArgs = buildRegionArgs(region);

  const getLevel = () => store.get(vpcLevelAtom);
  const setLevel = (level: VPCLevel) => store.set(vpcLevelAtom, level);
  const getBackStack = () => store.get(vpcBackStackAtom);
  const setBackStack = (stack: VPCNavFrame[]) => store.set(vpcBackStackAtom, stack);

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "vpcs") {
      return [
        { key: "name", label: "Name", width: 24 },
        { key: "vpcId", label: "VPC ID", width: 22 },
        { key: "cidr", label: "CIDR", width: 20 },
        { key: "state", label: "State", width: 12 },
        { key: "default", label: "Default", width: 8 },
      ];
    }
    if (level.kind === "security-groups") {
      return [
        { key: "name", label: "Name" },
        { key: "sgId", label: "SG ID", width: 22 },
        { key: "description", label: "Description" },
      ];
    }
    // rules level
    return [
      { key: "direction", label: "Direction", width: 10 },
      { key: "protocol", label: "Protocol", width: 10 },
      { key: "portRange", label: "Port Range", width: 14 },
      { key: "sourceDest", label: "Source / Destination" },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "vpcs") {
      try {
        const data = await runAwsJsonAsync<{ Vpcs: AwsVPC[] }>([
          "ec2",
          "describe-vpcs",
          ...regionArgs,
        ]);
        return (data.Vpcs ?? []).map((vpc) => {
          const name = getTagName(vpc.Tags);
          return {
            id: vpc.VpcId,
            cells: {
              name: textCell(name || "-"),
              vpcId: textCell(vpc.VpcId),
              cidr: textCell(vpc.CidrBlock),
              state: statusCell(vpc.State),
              default: textCell(vpc.IsDefault ? "Yes" : "No"),
            },
            meta: {
              type: "vpc",
              vpcId: vpc.VpcId,
              vpcName: name,
              cidr: vpc.CidrBlock,
            } satisfies VPCRowMeta,
          };
        });
      } catch (e) {
        debugLog("vpc", "getRows (vpcs) failed", e);
        return [];
      }
    }

    if (level.kind === "security-groups") {
      const { vpcId } = level;
      try {
        const data = await runAwsJsonAsync<{ SecurityGroups: AwsSecurityGroup[] }>([
          "ec2",
          "describe-security-groups",
          "--filters",
          `Name=vpc-id,Values=${vpcId}`,
          ...regionArgs,
        ]);
        return (data.SecurityGroups ?? []).map((sg) => ({
          id: sg.GroupId,
          cells: {
            name: textCell(sg.GroupName),
            sgId: textCell(sg.GroupId),
            description: textCell(sg.Description),
          },
          meta: {
            type: "security-group",
            sgId: sg.GroupId,
            sgName: sg.GroupName,
            vpcId,
          } satisfies VPCRowMeta,
        }));
      } catch (e) {
        debugLog("vpc", "getRows (security-groups) failed", e);
        return [];
      }
    }

    // rules level
    const { sgId } = level;
    try {
      const data = await runAwsJsonAsync<{ SecurityGroups: AwsSecurityGroup[] }>([
        "ec2",
        "describe-security-groups",
        "--group-ids",
        sgId,
        ...regionArgs,
      ]);
      const sg = data.SecurityGroups?.[0];
      if (!sg) return [];
      return buildRuleRows(sg);
    } catch (e) {
      debugLog("vpc", "getRows (rules) failed", e);
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as VPCRowMeta | undefined;

    if (level.kind === "vpcs") {
      if (!meta || meta.type !== "vpc") return { action: "none" };
      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({ kind: "security-groups", vpcId: meta.vpcId, vpcName: meta.vpcName });
      return { action: "navigate" };
    }

    if (level.kind === "security-groups") {
      if (!meta || meta.type !== "security-group") return { action: "none" };
      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({ kind: "rules", sgId: meta.sgId, sgName: meta.sgName, vpcId: meta.vpcId });
      return { action: "navigate" };
    }

    // rules level: leaf
    return { action: "none" };
  };

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "vpcs") return "vpc://";
    if (level.kind === "security-groups") return `vpc://${level.vpcName || level.vpcId}`;
    return `vpc://${level.vpcId}/${level.sgName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "vpcs") return "🌐 VPCs";
    if (level.kind === "security-groups") return `🌐 ${level.vpcName || level.vpcId}`;
    return `🌐 ${level.sgName}`;
  };

  const detailCapability = createVPCDetailCapability(region, getLevel);
  const yankCapability = createVPCYankCapability();

  const getBrowserUrl = (row: TableRow): string | null => {
    const r = region ?? "us-east-1";
    const meta = row.meta as VPCRowMeta | undefined;
    if (!meta) return null;
    if (meta.type === "vpc") {
      return `https://${r}.console.aws.amazon.com/vpc/home?region=${r}#vpcs:vpcId=${meta.vpcId}`;
    }
    if (meta.type === "security-group") {
      return `https://${r}.console.aws.amazon.com/vpc/home?region=${r}#SecurityGroups:group-id=${meta.sgId}`;
    }
    return null;
  };

  return {
    id: "vpc",
    label: "VPC",
    hudColor: SERVICE_COLORS.vpc ?? { bg: "blue", fg: "white" },
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    getBrowserUrl,
    reset() {
      setLevel({ kind: "vpcs" });
      setBackStack([]);
    },
    capabilities: {
      detail: detailCapability,
      yank: yankCapability,
    },
  };
}
