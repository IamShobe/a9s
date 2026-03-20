import type { ServiceAdapter, RelatedResource } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import type { BookmarkKeyPart } from "../../utils/bookmarks.js";
import { statusCell } from "../../utils/statusColors.js";
import { runAwsJsonAsync, buildRegionArgs, resolveRegion } from "../../utils/aws.js";
import { createStackState } from "../../utils/createStackState.js";
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


export function createRDSServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const regionArgs = buildRegionArgs(region);
  const { getLevel, setLevel, getBackStack, setBackStack, canGoBack, goBack, pushUiLevel, reset } = createStackState<RDSLevel, RDSNavFrame>({ kind: "instances" });

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
      { key: "created", label: "Created", width: 22, heatmap: { type: "date" } },
      { key: "size", label: "Size (GiB)", width: 12, heatmap: { type: "numeric" } },
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
            dbClusterIdentifier: inst.DBClusterIdentifier ?? "",
            masterUserSecretArn: inst.MasterUserSecret?.SecretArn ?? "",
            enabledCloudwatchLogs: inst.EnabledCloudwatchLogsExports ?? [],
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

  const getRelatedResources = async (row: TableRow): Promise<RelatedResource[]> => {
    const meta = row.meta as RDSRowMeta | undefined;
    if (!meta || meta.type !== "instance") return [];
    const id = meta.dbInstanceIdentifier ?? row.id;
    const resources: RelatedResource[] = [];

    // CloudWatch: only if logs are actually exported — query CloudWatch for actual log groups
    if (meta.enabledCloudwatchLogs && meta.enabledCloudwatchLogs.length > 0) {
      // Search by the cluster or instance identifier as a substring pattern — no path assumed
      const searchId = meta.dbClusterIdentifier || id;
      let filterHint: string | undefined;
      try {
        const logData = await runAwsJsonAsync<{ logGroups: Array<{ logGroupName: string }> }>([
          "logs", "describe-log-groups",
          "--log-group-name-pattern", searchId,
          ...regionArgs,
        ]);
        const groups = logData.logGroups ?? [];
        if (groups.length > 0) {
          // Derive the common parent path by stripping the last segment (log type) from the first result
          const firstName = groups[0].logGroupName;
          const parent = firstName.includes("/") ? firstName.slice(0, firstName.lastIndexOf("/")) : firstName;
          filterHint = parent;
        }
      } catch {
        // no CloudWatch entry if we can't confirm the groups exist
      }

      if (filterHint !== undefined) {
        resources.push({
          serviceId: "cloudwatch",
          label: `CloudWatch logs for ${id}`,
          filterHint,
        });
      }
    }

    // Secrets Manager: use actual managed secret name from ARN if available
    if (meta.masterUserSecretArn) {
      // ARN format: arn:aws:secretsmanager:region:account:secret:<name>
      const secretName = meta.masterUserSecretArn.split(":secret:")[1] ?? id;
      resources.push({
        serviceId: "secretsmanager",
        label: `Managed secret for ${id}`,
        filterHint: secretName,
      });
    } else {
      resources.push({
        serviceId: "secretsmanager",
        label: `Secrets for ${id}`,
        filterHint: id,
      });
    }

    return resources;
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
    pushUiLevel,
    getPath,
    getContextLabel,
    getRelatedResources,
    getBrowserUrl,
    reset,
    getBookmarkKey(row: TableRow): BookmarkKeyPart[] {
      const level = getLevel();
      if (level.kind === "instances") {
        return [{ label: "DB Instance", displayName: row.id, id: row.id }];
      }
      // snapshots level
      return [
        { label: "DB Instance", displayName: level.dbInstanceIdentifier, id: level.dbInstanceIdentifier },
        { label: "Snapshot", displayName: row.id, id: row.id },
      ];
    },
    restoreFromKey(key: BookmarkKeyPart[]): void {
      if (key.length === 1) {
        setBackStack([]);
        setLevel({ kind: "instances" });
      } else if (key.length >= 2) {
        const dbInstanceIdentifier = key[0]!.displayName;
        setBackStack([{ level: { kind: "instances" }, selectedIndex: 0 }]);
        setLevel({ kind: "snapshots", dbInstanceIdentifier, dbInstanceClass: "" });
      }
    },
    capabilities: {
      detail: detailCapability,
      yank: yankCapability,
      edit: editCapability,
      actions: actionCapability,
    },
  };
}
