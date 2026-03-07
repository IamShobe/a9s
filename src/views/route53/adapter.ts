import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../utils/aws.js";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { atom } from "jotai";
import { getDefaultStore } from "jotai";
import type {
  AwsHostedZone,
  AwsResourceRecordSet,
  Route53Level,
  Route53RowMeta,
} from "./types.js";
import { createRoute53DetailCapability } from "./capabilities/detailCapability.js";
import { createRoute53YankCapability } from "./capabilities/yankCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";

interface Route53NavFrame extends NavFrame {
  level: Route53Level;
}

export const route53LevelAtom = atom<Route53Level>({ kind: "zones" });
export const route53BackStackAtom = atom<Route53NavFrame[]>([]);

export function createRoute53ServiceAdapter(
  endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const store = getDefaultStore();
  const regionArgs = buildRegionArgs(region);

  const getLevel = () => store.get(route53LevelAtom);
  const setLevel = (level: Route53Level) => store.set(route53LevelAtom, level);
  const getBackStack = () => store.get(route53BackStackAtom);
  const setBackStack = (stack: Route53NavFrame[]) => store.set(route53BackStackAtom, stack);

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "zones") {
      return [
        { key: "name", label: "Name" },
        { key: "zoneId", label: "Zone ID" },
        { key: "recordCount", label: "Records" },
        { key: "type", label: "Type", width: 10 },
      ];
    }
    // records level
    return [
      { key: "name", label: "Name" },
      { key: "type", label: "Type", width: 10 },
      { key: "ttl", label: "TTL", width: 10 },
      { key: "values", label: "Value(s)", width: 50 },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "zones") {
      const data = await runAwsJsonAsync<{ HostedZones: AwsHostedZone[] }>([
        "route53",
        "list-hosted-zones",
        ...regionArgs,
      ]);

      return (data.HostedZones ?? []).map((zone) => {
        const isPrivate = zone.Config?.PrivateZone ?? zone.HostedZoneConfig?.PrivateZone ?? false;
        const shortZoneId = zone.Id.replace(/^\/hostedzone\//, "");

        return {
          id: zone.Id,
          cells: {
            name: textCell(zone.Name),
            zoneId: textCell(shortZoneId),
            recordCount: textCell(String(zone.ResourceRecordSetCount ?? 0)),
            type: textCell(isPrivate ? "Private" : "Public"),
          },
          meta: {
            type: "zone",
            zoneId: shortZoneId,
            zoneName: zone.Name,
            isPrivate,
          } satisfies Route53RowMeta,
        };
      });
    }

    // records level
    const { zoneId, zoneName } = level;
    try {
      const fullZoneId = zoneId.startsWith("/hostedzone/") ? zoneId : `/hostedzone/${zoneId}`;
      const data = await runAwsJsonAsync<{
        ResourceRecordSets: AwsResourceRecordSet[];
      }>([
        "route53",
        "list-resource-record-sets",
        "--hosted-zone-id",
        fullZoneId,
        ...regionArgs,
      ]);

      return (data.ResourceRecordSets ?? []).map((record) => {
        const values: string[] = [];
        let valuesDisplay = "";

        if (record.AliasTarget) {
          valuesDisplay = `ALIAS → ${record.AliasTarget.DNSName}`;
        } else if (record.ResourceRecords && record.ResourceRecords.length > 0) {
          record.ResourceRecords.forEach((r) => values.push(r.Value));
          if (values.length <= 3) {
            valuesDisplay = values.join(", ");
          } else {
            valuesDisplay = `<${values.length} values>`;
          }
        }

        return {
          id: `${record.Name}-${record.Type}`,
          cells: {
            name: textCell(record.Name),
            type: textCell(record.Type),
            ttl: textCell(record.AliasTarget ? "-" : String(record.TTL ?? "-")),
            values: textCell(valuesDisplay),
          },
          meta: {
            type: "record",
            zoneId,
            zoneName,
            recordName: record.Name,
            recordType: record.Type,
            recordTtl: record.TTL,
            recordValues: values,
            recordAliasTarget: record.AliasTarget,
          } satisfies Route53RowMeta,
        };
      });
    } catch {
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as Route53RowMeta | undefined;

    if (level.kind === "zones") {
      if (!meta || meta.type !== "zone") {
        return { action: "none" };
      }

      const newStack = [...backStack, { level: level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "records",
        zoneId: meta.zoneId!,
        zoneName: meta.zoneName!,
      });
      return { action: "navigate" };
    }

    // records level: leaf, no drill-down
    return { action: "none" };
  };

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "zones") return "route53://";
    return `route53://${level.zoneName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "zones") return "🌐 Hosted Zones";
    return `🌐 ${level.zoneName}`;
  };

  // Compose capabilities
  const detailCapability = createRoute53DetailCapability(region, getLevel);
  const yankCapability = createRoute53YankCapability();

  return {
    id: "route53",
    label: "Route53",
    hudColor: SERVICE_COLORS.route53,
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    reset() {
      setLevel({ kind: "zones" });
      setBackStack([]);
    },
    capabilities: {
      detail: detailCapability,
      yank: yankCapability,
    },
  };
}
