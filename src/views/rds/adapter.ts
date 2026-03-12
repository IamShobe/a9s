import type { ServiceAdapter, RelatedResource } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import { statusCell } from "../../utils/statusColors.js";
import { runAwsJsonAsync, buildRegionArgs, resolveRegion } from "../../utils/aws.js";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { atom, getDefaultStore } from "jotai";
import type { AwsRDSInstance, AwsRDSSnapshot, RDSLevel, RDSRowMeta } from "./types.js";
import { createRDSDetailCapability } from "./capabilities/detailCapability.js";
import { createRDSYankCapability } from "./capabilities/yankCapability.js";
import { createRDSEditCapability } from "./capabilities/editCapability.js";
import { createRDSActionCapability } from "./capabilities/actionCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";
import { ageBandProps } from "../../utils/ageBanding.js";

interface RDSNavFrame extends NavFrame {
  level: RDSLevel;
}

export const rdsLevelAtom = atom<RDSLevel>({ kind: "instances" });
export const rdsBackStackAtom = atom<RDSNavFrame[]>([]);

export function createRDSServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const store = getDefaultStore();
  const regionArgs = buildRegionArgs(region);

  const getLevel = () => store.get(rdsLevelAtom);
  const setLevel = (level: RDSLevel) => store.set(rdsLevelAtom, level);
  const getBackStack = () => store.get(rdsBackStackAtom);
  const setBackStack = (stack: RDSNavFrame[]) => store.set(rdsBackStackAtom, stack);

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "instances") {
      return [
        { key: "identifier", label: "Identifier", width: 28 },
        { key: "status", label: "Status", width: 14 },
        { key: "engine", label: "Engine", width: 20 },
        { key: "class", label: "Class", width: 16 },
        { key: "az", label: "AZ", width: 14 },
        { key: "multiaz", label: "Multi-AZ" },
      ];
    }
    // snapshots level
    return [
      { key: "snapshotId", label: "Snapshot ID", width: 32 },
      { key: "status", label: "Status", width: 14 },
      { key: "type", label: "Type", width: 12 },
      { key: "created", label: "Created", width: 22 },
      { key: "size", label: "Size (GiB)", width: 12 },
      { key: "encrypted", label: "Encrypted" },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "instances") {
      try {
        const data = await runAwsJsonAsync<{ DBInstances: AwsRDSInstance[] }>([
          "rds",
          "describe-db-instances",
          ...regionArgs,
        ]);

        return (data.DBInstances ?? []).map((inst) => ({
          id: inst.DBInstanceIdentifier,
          cells: {
            identifier: textCell(inst.DBInstanceIdentifier),
            status: statusCell(inst.DBInstanceStatus ?? "-"),
            engine: textCell(`${inst.Engine ?? "-"} ${inst.EngineVersion ?? ""}`.trim()),
            class: textCell(inst.DBInstanceClass ?? "-"),
            az: textCell(inst.AvailabilityZone ?? "-"),
            multiaz: textCell(inst.MultiAZ ? "Yes" : "No"),
          },
          meta: {
            type: "instance",
            dbInstanceIdentifier: inst.DBInstanceIdentifier,
            dbInstanceArn: inst.DBInstanceArn ?? "",
            engine: inst.Engine ?? "",
            engineVersion: inst.EngineVersion ?? "",
            dbInstanceClass: inst.DBInstanceClass ?? "",
            status: inst.DBInstanceStatus ?? "",
            multiAZ: inst.MultiAZ ?? false,
          } satisfies RDSRowMeta,
        }));
      } catch (e) {
        debugLog("rds", "getRows (instances) failed", e);
        return [];
      }
    }

    // snapshots level
    const { dbInstanceIdentifier } = level;
    try {
      const data = await runAwsJsonAsync<{ DBSnapshots: AwsRDSSnapshot[] }>([
        "rds",
        "describe-db-snapshots",
        "--db-instance-identifier",
        dbInstanceIdentifier,
        ...regionArgs,
      ]);

      return (data.DBSnapshots ?? []).map((snap) => ({
        id: snap.DBSnapshotIdentifier,
        cells: {
          snapshotId: textCell(snap.DBSnapshotIdentifier),
          status: statusCell(snap.Status ?? "-"),
          type: textCell(snap.SnapshotType ?? "-"),
          created: textCell(snap.SnapshotCreateTime ? snap.SnapshotCreateTime.slice(0, 19).replace("T", " ") : "-"),
          size: textCell(snap.AllocatedStorage != null ? String(snap.AllocatedStorage) : "-"),
          encrypted: textCell(snap.Encrypted ? "Yes" : "No"),
        },
        meta: {
          type: "snapshot",
          snapshotIdentifier: snap.DBSnapshotIdentifier,
          snapshotArn: snap.DBSnapshotArn ?? "",
          dbInstanceIdentifier: snap.DBInstanceIdentifier ?? dbInstanceIdentifier,
          status: snap.Status ?? "",
          snapshotType: snap.SnapshotType ?? "",
        } satisfies RDSRowMeta,
        ...ageBandProps(snap.SnapshotCreateTime),
      }));
    } catch (e) {
      debugLog("rds", "getRows (snapshots) failed", e);
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as RDSRowMeta | undefined;

    if (level.kind === "instances") {
      if (!meta || meta.type !== "instance") return { action: "none" };

      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "snapshots",
        dbInstanceIdentifier: meta.dbInstanceIdentifier,
        dbInstanceClass: meta.dbInstanceClass,
      });
      return { action: "navigate" };
    }

    // snapshots level: leaf
    return { action: "none" };
  };

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "instances") return "rds://";
    return `rds://${level.dbInstanceIdentifier}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "instances") return "🗄️  RDS Instances";
    return `🗄️  ${level.dbInstanceIdentifier}`;
  };

  const detailCapability = createRDSDetailCapability(region, getLevel);
  const yankCapability = createRDSYankCapability();
  const editCapability = createRDSEditCapability(region, getLevel);
  const actionCapability = createRDSActionCapability(region, getLevel);

  const getRelatedResources = (row: TableRow): RelatedResource[] => {
    const meta = row.meta as RDSRowMeta | undefined;
    if (!meta || meta.type !== "instance") return [];
    const id = meta.dbInstanceIdentifier ?? row.id;
    return [
      { serviceId: "cloudwatch", label: `CloudWatch logs for ${id}`, filterHint: `/aws/rds/instance/${id}` },
      { serviceId: "secretsmanager", label: `Secrets for ${id}`, filterHint: id },
    ];
  };

  const getBrowserUrl = (row: TableRow): string | null => {
    const r = resolveRegion(region);
    const meta = row.meta as RDSRowMeta | undefined;
    if (!meta) return null;
    if (meta.type === "instance") {
      return `https://${r}.console.aws.amazon.com/rds/home?region=${r}#database:id=${meta.dbInstanceIdentifier};is-cluster=false`;
    }
    if (meta.type === "snapshot") {
      return `https://${r}.console.aws.amazon.com/rds/home?region=${r}#db-snapshot:id=${meta.snapshotIdentifier}`;
    }
    return null;
  };

  return {
    id: "rds",
    label: "RDS",
    hudColor: SERVICE_COLORS.rds ?? { bg: "red", fg: "white" },
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    getRelatedResources,
    getBrowserUrl,
    reset() {
      setLevel({ kind: "instances" });
      setBackStack([]);
    },
    capabilities: {
      detail: detailCapability,
      yank: yankCapability,
      edit: editCapability,
      actions: actionCapability,
    },
  };
}
