import type { ServiceAdapter, RelatedResource } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import type { BookmarkKeyPart } from "../../utils/bookmarks.js";
import { statusCell } from "../../utils/statusColors.js";
import { runAwsJsonAsync, buildRegionArgs, resolveRegion } from "../../utils/aws.js";
import { createStackState } from "../../utils/createStackState.js";
import type {
  AwsLoadBalancer,
  AwsTargetGroup,
  AwsTargetHealthDescription,
  ELBLevel,
  ELBRowMeta,
} from "./types.js";
import { createELBDetailCapability } from "./capabilities/detailCapability.js";
import { createELBYankCapability } from "./capabilities/yankCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";

interface ELBNavFrame extends NavFrame {
  level: ELBLevel;
}


function lbTypeLabel(type: string): string {
  switch (type) {
    case "application": return "ALB";
    case "network":     return "NLB";
    case "gateway":     return "GWLB";
    default:            return type.toUpperCase();
  }
}

export function createELBServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const regionArgs = buildRegionArgs(region);
  const { getLevel, setLevel, getBackStack, setBackStack, canGoBack, goBack, pushUiLevel, reset } = createStackState<ELBLevel, ELBNavFrame>({ kind: "load-balancers" });

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "load-balancers") {
      return [
        { key: "name", label: "Name" },
        { key: "lbType", label: "Type", width: 6 },
        { key: "state", label: "State", width: 10 },
        { key: "scheme", label: "Scheme", width: 16 },
        { key: "dnsName", label: "DNS Name" },
      ];
    }
    if (level.kind === "target-groups") {
      return [
        { key: "name", label: "Name" },
        { key: "protocol", label: "Protocol", width: 10 },
        { key: "port", label: "Port", width: 8 },
        { key: "targetType", label: "Target Type", width: 12 },
        { key: "health", label: "Health", width: 12 },
      ];
    }
    // targets level
    return [
      { key: "targetId", label: "Target ID" },
      { key: "port", label: "Port", width: 8 },
      { key: "health", label: "Health", width: 12 },
      { key: "az", label: "AZ", width: 18 },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "load-balancers") {
      try {
        const data = await runAwsJsonAsync<{ LoadBalancers: AwsLoadBalancer[] }>([
          "elbv2",
          "describe-load-balancers",
          ...regionArgs,
        ]);

        return (data.LoadBalancers ?? []).map((lb) => ({
          id: lb.LoadBalancerArn,
          cells: {
            name: textCell(lb.LoadBalancerName),
            lbType: textCell(lbTypeLabel(lb.Type)),
            state: statusCell(lb.State?.Code ?? "-"),
            scheme: textCell(lb.Scheme ?? "-"),
            dnsName: textCell(lb.DNSName ?? "-"),
          },
          meta: {
            type: "load-balancer",
            lbArn: lb.LoadBalancerArn,
            lbName: lb.LoadBalancerName,
            lbType: lb.Type,
            dnsName: lb.DNSName ?? "",
            scheme: lb.Scheme ?? "",
          } satisfies ELBRowMeta,
        }));
      } catch (e) {
        debugLog("elb", "getRows (load-balancers) failed", e);
        return [];
      }
    }

    if (level.kind === "target-groups") {
      const { lbArn } = level;
      try {
        const data = await runAwsJsonAsync<{ TargetGroups: AwsTargetGroup[] }>([
          "elbv2",
          "describe-target-groups",
          "--load-balancer-arn",
          lbArn,
          ...regionArgs,
        ]);

        // For each TG, fetch health summary
        const rows: TableRow[] = [];
        for (const tg of data.TargetGroups ?? []) {
          let healthSummary = "-";
          try {
            const healthData = await runAwsJsonAsync<{
              TargetHealthDescriptions: AwsTargetHealthDescription[];
            }>([
              "elbv2",
              "describe-target-health",
              "--target-group-arn",
              tg.TargetGroupArn,
              ...regionArgs,
            ]);
            const descs = healthData.TargetHealthDescriptions ?? [];
            const healthy = descs.filter((d) => d.TargetHealth.State === "healthy").length;
            healthSummary = `${healthy}/${descs.length}`;
          } catch {
            // ignore health fetch errors
          }

          rows.push({
            id: tg.TargetGroupArn,
            cells: {
              name: textCell(tg.TargetGroupName),
              protocol: textCell(tg.Protocol ?? "-"),
              port: textCell(tg.Port != null ? String(tg.Port) : "-"),
              targetType: textCell(tg.TargetType ?? "-"),
              health: textCell(healthSummary),
            },
            meta: {
              type: "target-group",
              tgArn: tg.TargetGroupArn,
              tgName: tg.TargetGroupName,
              lbArn,
            } satisfies ELBRowMeta,
          });
        }
        return rows;
      } catch (e) {
        debugLog("elb", "getRows (target-groups) failed", e);
        return [];
      }
    }

    // targets level
    const { tgArn, tgName } = level;
    try {
      const data = await runAwsJsonAsync<{
        TargetHealthDescriptions: AwsTargetHealthDescription[];
      }>([
        "elbv2",
        "describe-target-health",
        "--target-group-arn",
        tgArn,
        ...regionArgs,
      ]);

      return (data.TargetHealthDescriptions ?? []).map((desc) => ({
        id: `${tgArn}/${desc.Target.Id}/${desc.Target.Port ?? ""}`,
        cells: {
          targetId: textCell(desc.Target.Id),
          port: textCell(desc.Target.Port != null ? String(desc.Target.Port) : "-"),
          health: statusCell(desc.TargetHealth.State),
          az: textCell(desc.Target.AvailabilityZone ?? "-"),
        },
        meta: {
          type: "target",
          targetId: desc.Target.Id,
          health: desc.TargetHealth.State,
          tgArn,
        } satisfies ELBRowMeta,
      }));
    } catch (e) {
      debugLog("elb", `getRows (targets for ${tgName}) failed`, e);
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as ELBRowMeta | undefined;

    if (level.kind === "load-balancers") {
      if (!meta || meta.type !== "load-balancer") return { action: "none" };

      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "target-groups",
        lbArn: meta.lbArn,
        lbName: meta.lbName,
        lbType: meta.lbType,
      });
      return { action: "navigate" };
    }

    if (level.kind === "target-groups") {
      if (!meta || meta.type !== "target-group") return { action: "none" };

      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "targets",
        tgArn: meta.tgArn,
        tgName: meta.tgName,
        lbArn: level.lbArn,
      });
      return { action: "navigate" };
    }

    // targets level: leaf
    return { action: "none" };
  };

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "load-balancers") return "elb://";
    if (level.kind === "target-groups") return `elb://${level.lbName}`;
    return `elb://${level.lbArn.split("/")[1] ?? ""}/${level.tgName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "load-balancers") return "⚖️  Load Balancers";
    if (level.kind === "target-groups") return `⚖️  ${level.lbName}`;
    return `⚖️  ${level.tgName}`;
  };

  const detailCapability = createELBDetailCapability(region, getLevel);
  const yankCapability = createELBYankCapability();

  const getRelatedResources = (row: TableRow): RelatedResource[] => {
    const meta = row.meta as ELBRowMeta | undefined;
    if (!meta || meta.type !== "load-balancer") return [];
    const name = meta.lbName ?? row.id;
    return [
      { serviceId: "cloudwatch", label: `CloudWatch metrics for ${name}`, filterHint: name },
      { serviceId: "ec2", label: `EC2 targets for ${name}`, filterHint: name },
    ];
  };

  const getBrowserUrl = (row: TableRow): string | null => {
    const r = resolveRegion(region);
    const meta = row.meta as ELBRowMeta | undefined;
    if (!meta) return null;
    if (meta.type === "load-balancer") {
      return `https://${r}.console.aws.amazon.com/ec2/v2/home?region=${r}#LoadBalancers:search=${encodeURIComponent(meta.lbArn)}`;
    }
    if (meta.type === "target-group") {
      return `https://${r}.console.aws.amazon.com/ec2/v2/home?region=${r}#TargetGroups:search=${encodeURIComponent(meta.tgArn)}`;
    }
    return null;
  };

  return {
    id: "elb",
    label: "Load Balancers",
    hudColor: SERVICE_COLORS.elb ?? { bg: "cyan", fg: "black" },
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    pushUiLevel,
    getPath,
    getContextLabel,
    getRelatedResources,
    getBrowserUrl,
    reset,
    getBookmarkKey(row: TableRow): BookmarkKeyPart[] {
      const level = getLevel();
      const meta = row.meta as ELBRowMeta | undefined;
      if (level.kind === "load-balancers") {
        const lbName = meta?.type === "load-balancer" ? meta.lbName : row.id;
        return [{ label: "Load Balancer", displayName: lbName, id: row.id }];
      }
      if (level.kind === "target-groups") {
        const tgName = meta?.type === "target-group" ? meta.tgName : row.id;
        return [
          { label: "Load Balancer", displayName: level.lbName, id: level.lbArn },
          { label: "Target Group", displayName: tgName, id: row.id },
        ];
      }
      // targets level
      const targetId = meta?.type === "target" ? meta.targetId : row.id;
      return [
        { label: "Load Balancer", displayName: level.lbArn.split("/")[2] ?? level.lbArn, id: level.lbArn },
        { label: "Target Group", displayName: level.tgName, id: level.tgArn },
        { label: "Target", displayName: targetId, id: row.id },
      ];
    },
    restoreFromKey(key: BookmarkKeyPart[]): void {
      if (key.length === 1) {
        setBackStack([]);
        setLevel({ kind: "load-balancers" });
      } else if (key.length === 2) {
        const lbArn = key[0]!.id ?? key[0]!.displayName;
        const lbName = key[0]!.displayName;
        setBackStack([{ level: { kind: "load-balancers" }, selectedIndex: 0 }]);
        setLevel({ kind: "target-groups", lbArn, lbName, lbType: "" });
      } else if (key.length >= 3) {
        const lbArn = key[0]!.id ?? key[0]!.displayName;
        const lbName = key[0]!.displayName;
        const tgArn = key[1]!.id ?? key[1]!.displayName;
        const tgName = key[1]!.displayName;
        setBackStack([
          { level: { kind: "load-balancers" }, selectedIndex: 0 },
          { level: { kind: "target-groups", lbArn, lbName, lbType: "" }, selectedIndex: 0 },
        ]);
        setLevel({ kind: "targets", tgArn, tgName, lbArn });
      }
    },
    capabilities: {
      detail: detailCapability,
      yank: yankCapability,
    },
  };
}
