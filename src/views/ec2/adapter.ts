import type { ServiceAdapter, RelatedResource } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import { statusCell } from "../../utils/statusColors.js";
import { runAwsJsonAsync, buildRegionArgs, resolveRegion } from "../../utils/aws.js";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { atom, getDefaultStore } from "jotai";
import type { AwsInstance, AwsVolume, EC2Level, EC2RowMeta } from "./types.js";
import { createEC2DetailCapability } from "./capabilities/detailCapability.js";
import { createEC2YankCapability } from "./capabilities/yankCapability.js";
import { createEC2EditCapability } from "./capabilities/editCapability.js";
import { createEC2ActionCapability } from "./capabilities/actionCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";
import { debugLog } from "../../utils/debugLogger.js";

interface EC2NavFrame extends NavFrame {
  level: EC2Level;
}

export const ec2LevelAtom = atom<EC2Level>({ kind: "instances" });
export const ec2BackStackAtom = atom<EC2NavFrame[]>([]);

function getInstanceName(instance: AwsInstance): string {
  return (instance.Tags ?? []).find((t) => t.Key === "Name")?.Value ?? instance.InstanceId;
}

export function createEC2ServiceAdapter(
  _endpointUrl?: string,
  region?: string,
): ServiceAdapter {
  const store = getDefaultStore();
  const regionArgs = buildRegionArgs(region);

  const getLevel = () => store.get(ec2LevelAtom);
  const setLevel = (level: EC2Level) => store.set(ec2LevelAtom, level);
  const getBackStack = () => store.get(ec2BackStackAtom);
  const setBackStack = (stack: EC2NavFrame[]) => store.set(ec2BackStackAtom, stack);

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "instances") {
      return [
        { key: "name", label: "Name" },
        { key: "state", label: "State", width: 12 },
        { key: "type", label: "Type", width: 15 },
        { key: "publicIp", label: "Public IP", width: 15 },
        { key: "privateIp", label: "Private IP", width: 15 },
        { key: "az", label: "AZ", width: 18 },
      ];
    }
    // volumes level
    return [
      { key: "volumeId", label: "Volume ID", width: 24 },
      { key: "size", label: "Size", width: 10 },
      { key: "state", label: "State", width: 12 },
      { key: "device", label: "Device", width: 12 },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();

    if (level.kind === "instances") {
      try {
        const instances = await runAwsJsonAsync<AwsInstance[] | null>([
          "ec2",
          "describe-instances",
          "--query",
          "Reservations[].Instances[]",
          ...regionArgs,
        ]);

        return (instances ?? []).map((inst) => {
          const name = getInstanceName(inst);
          const tags = Object.fromEntries(
            (inst.Tags ?? []).map((t) => [t.Key, t.Value]),
          );
          return {
            id: inst.InstanceId,
            cells: {
              name: textCell(name),
              state: statusCell(inst.State?.Name ?? "-"),
              type: textCell(inst.InstanceType ?? "-"),
              publicIp: textCell(inst.PublicIpAddress ?? "-"),
              privateIp: textCell(inst.PrivateIpAddress ?? "-"),
              az: textCell(inst.Placement?.AvailabilityZone ?? "-"),
            },
            meta: {
              type: "instance",
              instanceId: inst.InstanceId,
              instanceName: name,
              state: inst.State?.Name ?? "",
              publicIp: inst.PublicIpAddress ?? "",
              privateIp: inst.PrivateIpAddress ?? "",
            } satisfies EC2RowMeta,
            tags,
          };
        });
      } catch (e) {
        debugLog("ec2", "getRows (instances) failed", e);
        return [];
      }
    }

    // volumes level
    const { instanceId, instanceName } = level;
    try {
      const data = await runAwsJsonAsync<{ Volumes: AwsVolume[] }>([
        "ec2",
        "describe-volumes",
        "--filters",
        `Name=attachment.instance-id,Values=${instanceId}`,
        ...regionArgs,
      ]);

      return (data.Volumes ?? []).map((vol) => {
        const attachment = vol.Attachments?.[0];
        return {
          id: vol.VolumeId,
          cells: {
            volumeId: textCell(vol.VolumeId),
            size: textCell(vol.Size != null ? `${vol.Size} GiB` : "-"),
            state: statusCell(vol.State ?? "-"),
            device: textCell(attachment?.Device ?? "-"),
          },
          meta: {
            type: "volume",
            volumeId: vol.VolumeId,
            instanceId,
            instanceName,
          } satisfies EC2RowMeta,
        };
      });
    } catch (e) {
      debugLog("ec2", "getRows (volumes) failed", e);
      return [];
    }
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    const meta = row.meta as EC2RowMeta | undefined;

    if (level.kind === "instances") {
      if (!meta || meta.type !== "instance") return { action: "none" };

      const newStack = [...backStack, { level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "volumes",
        instanceId: meta.instanceId,
        instanceName: meta.instanceName,
      });
      return { action: "navigate" };
    }

    // volumes level: leaf
    return { action: "none" };
  };

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "instances") return "ec2://";
    return `ec2://${level.instanceName}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "instances") return "🖥️  EC2 Instances";
    return `🖥️  ${level.instanceName}`;
  };

  const detailCapability = createEC2DetailCapability(region, getLevel);
  const yankCapability = createEC2YankCapability();
  const editCapability = createEC2EditCapability(region, getLevel);
  const actionCapability = createEC2ActionCapability(region, getLevel);

  const getRelatedResources = (row: TableRow): RelatedResource[] => {
    const meta = row.meta as EC2RowMeta | undefined;
    if (!meta) return [];
    if (meta.type === "instance") {
      return [
        {
          serviceId: "cloudwatch",
          label: `CloudWatch logs for ${meta.instanceName || meta.instanceId}`,
        },
        {
          serviceId: "vpc",
          label: "VPC / Security Groups",
        },
      ];
    }
    return [];
  };

  const getBrowserUrl = (row: TableRow): string | null => {
    const r = resolveRegion(region);
    const meta = row.meta as EC2RowMeta | undefined;
    if (!meta) return null;
    if (meta.type === "instance") {
      return `https://${r}.console.aws.amazon.com/ec2/v2/home?region=${r}#Instances:instanceId=${meta.instanceId}`;
    }
    if (meta.type === "volume") {
      return `https://${r}.console.aws.amazon.com/ec2/v2/home?region=${r}#Volumes:volumeId=${meta.volumeId}`;
    }
    return null;
  };

  return {
    id: "ec2",
    label: "EC2",
    hudColor: SERVICE_COLORS.ec2 ?? { bg: "yellow", fg: "black" },
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
