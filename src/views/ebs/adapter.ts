import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import { statusCell } from "../../utils/statusColors.js";
import { runAwsJsonAsync, buildRegionArgs } from "../../utils/aws.js";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { atom, getDefaultStore } from "jotai";
import type { AwsEBSSnapshot, AwsEBSVolume, EBSLevel, EBSRowMeta } from "./types.js";
import { createEBSDetailCapability } from "./capabilities/detailCapability.js";
import { createEBSYankCapability } from "./capabilities/yankCapability.js";
import { createEBSEditCapability } from "./capabilities/editCapability.js";
import { createEBSActionCapability } from "./capabilities/actionCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";

interface EBSNavFrame extends NavFrame {
  level: EBSLevel;
}

export const ebsLevelAtom = atom<EBSLevel>({ kind: "volumes" });
export const ebsBackStackAtom = atom<EBSNavFrame[]>([]);

function formatBytes(gib?: number): string {
  if (gib == null) return "-";
  return `${gib} GiB`;
}

export function createEBSServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const store = getDefaultStore();
  const regionArgs = buildRegionArgs(region);

  const getLevel = () => store.get(ebsLevelAtom);
  const setLevel = (level: EBSLevel) => store.set(ebsLevelAtom, level);
  const getBackStack = () => store.get(ebsBackStackAtom);
  const setBackStack = (stack: EBSNavFrame[]) => store.set(ebsBackStackAtom, stack);

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "volumes") {
      return [
        { key: "volumeId", label: "Volume ID", width: 24 },
        { key: "size", label: "Size", width: 10 },
        { key: "state", label: "State", width: 12 },
        { key: "type", label: "Type", width: 8 },
        { key: "az", label: "AZ", width: 18 },
        { key: "attachment", label: "Attachment" },
      ];
    }
    // snapshots level
    return [
      { key: "snapshotId", label: "Snapshot ID", width: 24 },
      { key: "state", label: "State", width: 12 },
      { key: "progress", label: "Progress", width: 10 },
      { key: "startTime", label: "Started", width: 22 },
      { key: "description", label: "Description" },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "volumes") {
      try {
        const data = await runAwsJsonAsync<{ Volumes: AwsEBSVolume[] }>([
          "ec2",
          "describe-volumes",
          ...regionArgs,
        ]);

        return (data.Volumes ?? []).map((vol) => {
          const attachment = vol.Attachments?.[0];
          const attachDisplay = attachment
            ? `${attachment.InstanceId} (${attachment.Device})`
            : "-";

          return {
            id: vol.VolumeId,
            cells: {
              volumeId: textCell(vol.VolumeId),
              size: textCell(formatBytes(vol.Size)),
              state: statusCell(vol.State ?? "-"),
              type: textCell(vol.VolumeType ?? "-"),
              az: textCell(vol.AvailabilityZone ?? "-"),
              attachment: textCell(attachDisplay),
            },
            meta: {
              type: "volume",
              volumeId: vol.VolumeId,
              state: vol.State ?? "",
              attachedInstanceId: attachment?.InstanceId ?? "",
            } satisfies EBSRowMeta,
          };
        });
      } catch (e) {
        debugLog("ebs", "getRows (volumes) failed", e);
        return [];
      }
    }

    // snapshots level
    const { volumeId } = level;
    try {
      const data = await runAwsJsonAsync<{ Snapshots: AwsEBSSnapshot[] }>([
        "ec2",
        "describe-snapshots",
        "--owner-ids",
        "self",
        "--filters",
        `Name=volume-id,Values=${volumeId}`,
        ...regionArgs,
      ]);

      return (data.Snapshots ?? []).map((snap) => ({
        id: snap.SnapshotId,
        cells: {
          snapshotId: textCell(snap.SnapshotId),
          state: statusCell(snap.State),
          progress: textCell(snap.Progress ?? "-"),
          startTime: textCell(snap.StartTime ? snap.StartTime.slice(0, 19).replace("T", " ") : "-"),
          description: textCell(snap.Description || "-"),
        },
        meta: {
          type: "snapshot",
          snapshotId: snap.SnapshotId,
          volumeId: snap.VolumeId,
          state: snap.State,
        } satisfies EBSRowMeta,
      }));
    } catch (e) {
      debugLog("ebs", "getRows (snapshots) failed", e);
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as EBSRowMeta | undefined;

    if (level.kind === "volumes") {
      if (!meta || meta.type !== "volume") return { action: "none" };

      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "snapshots",
        volumeId: meta.volumeId,
        volumeSize: 0,
      });
      return { action: "navigate" };
    }

    // snapshots level: leaf
    return { action: "none" };
  };

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "volumes") return "ebs://";
    return `ebs://${level.volumeId}/snapshots`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "volumes") return "💾 EBS Volumes";
    return `💾 ${level.volumeId}`;
  };

  const detailCapability = createEBSDetailCapability(region, getLevel);
  const yankCapability = createEBSYankCapability();
  const editCapability = createEBSEditCapability(region, getLevel);
  const actionCapability = createEBSActionCapability(region, getLevel);

  const getBrowserUrl = (row: TableRow): string | null => {
    const r = region ?? "us-east-1";
    const meta = row.meta as EBSRowMeta | undefined;
    if (!meta) return null;
    if (meta.type === "volume") {
      return `https://${r}.console.aws.amazon.com/ec2/v2/home?region=${r}#Volumes:volumeId=${meta.volumeId}`;
    }
    if (meta.type === "snapshot") {
      return `https://${r}.console.aws.amazon.com/ec2/v2/home?region=${r}#Snapshots:snapshotId=${meta.snapshotId}`;
    }
    return null;
  };

  return {
    id: "ebs",
    label: "EBS",
    hudColor: SERVICE_COLORS.ebs ?? { bg: "yellow", fg: "black" },
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    getBrowserUrl,
    reset() {
      setLevel({ kind: "volumes" });
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
