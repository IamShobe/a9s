import type { ServiceAdapter } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import { createS3Client } from "./client.js";
import { fetchBuckets, fetchObjects, downloadObject } from "./fetcher.js";
import type { S3Client } from "@aws-sdk/client-s3";
import { atom } from "jotai";
import { getDefaultStore } from "jotai";
import { createBackStackHelpers } from "../../adapters/backStackUtils.js";
import { formatSize } from "./utils.js";
import { createS3EditCapability } from "./capabilities/editCapability.js";
import { createS3DetailCapability } from "./capabilities/detailCapability.js";
import { createS3YankCapability } from "./capabilities/yankCapability.js";
import { createS3ActionCapability } from "./capabilities/actionCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";

export type S3Level = { kind: "buckets" } | { kind: "objects"; bucket: string; prefix: string };

interface S3NavFrame extends NavFrame {
  level: S3Level;
}

export const s3LevelAtom = atom<S3Level>({ kind: "buckets" });
export const s3BackStackAtom = atom<S3NavFrame[]>([]);

export function createS3ServiceAdapter(endpointUrl?: string, region?: string): ServiceAdapter {
  const store = getDefaultStore();
  const client: S3Client = createS3Client(endpointUrl, region);

  // Getters and setters for level/backStack from atoms
  const getLevel = () => store.get(s3LevelAtom);
  const setLevel = (level: S3Level) => store.set(s3LevelAtom, level);
  const getBackStack = () => store.get(s3BackStackAtom);
  const setBackStack = (stack: S3NavFrame[]) => store.set(s3BackStackAtom, stack);

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "buckets") {
      return [
        { key: "name", label: "Name" },
        { key: "type", label: "Type", width: 10 },
        { key: "creationDate", label: "Creation Date", width: 22 },
      ];
    }
    return [
      { key: "name", label: "Name" },
      { key: "type", label: "Type", width: 10 },
      { key: "size", label: "Size", width: 12 },
      { key: "lastModified", label: "Last Modified", width: 22 },
    ];
  };

  const getRows = async (): Promise<TableRow[]> => {
    const level = getLevel();
    if (level.kind === "buckets") {
      const buckets = await fetchBuckets(client);
      return buckets.map((b) => ({
        id: b.name,
        cells: {
          name: textCell(b.name),
          type: textCell("Bucket"),
          creationDate: textCell(
            b.creationDate ? b.creationDate.toISOString().replace("T", " ").slice(0, 19) : "-",
          ),
        },
        meta: { type: "bucket" },
      }));
    }

    const { bucket, prefix } = level;
    const objects = await fetchObjects(client, bucket, prefix);
    return objects.map((obj) => {
      const displayKey = obj.key.slice(prefix.length);
      return {
        id: obj.key,
        cells: {
          name: textCell(displayKey),
          type: textCell(obj.isFolder ? "Folder" : "File"),
          size: textCell(obj.isFolder ? "" : formatSize(obj.size)),
          lastModified: textCell(
            obj.lastModified ? obj.lastModified.toISOString().replace("T", " ").slice(0, 19) : "",
          ),
        },
        meta: { type: obj.isFolder ? "folder" : "object", key: obj.key },
      };
    });
  };

  const onSelect = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel();
    const backStack = getBackStack();
    if (level.kind === "buckets") {
      const newStack = [...backStack, { level: level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({ kind: "objects", bucket: row.id, prefix: "" });
      return { action: "navigate" };
    }

    const type = row.meta?.type as string;
    if (type === "folder") {
      const newStack = [...backStack, { level: level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "objects",
        bucket: level.bucket,
        prefix: row.meta?.key as string,
      });
      return { action: "navigate" };
    }

    if (type === "object") {
      const filePath = await downloadObject(client, level.bucket, row.meta?.key as string);
      return {
        action: "edit",
        filePath,
        metadata: {
          bucket: level.bucket,
          key: row.meta?.key,
        },
      };
    }

    return { action: "none" };
  };

  const { canGoBack, goBack } = createBackStackHelpers(getLevel, setLevel, getBackStack, setBackStack);

  const getPath = (): string => {
    const level = getLevel();
    if (level.kind === "buckets") return "s3://";
    const { bucket, prefix } = level;
    return `s3://${bucket}/${prefix}`;
  };

  const getContextLabel = (): string => {
    const level = getLevel();
    if (level.kind === "buckets") return "🪣 Buckets";
    const prefix = level.prefix ? ` › ${level.prefix}` : "";
    return `📦 ${level.bucket}${prefix}`;
  };

  // Compose capabilities
  const detailCapability = createS3DetailCapability(client, getLevel);
  const editCapability = createS3EditCapability(client, getLevel);
  const yankCapability = createS3YankCapability({
    getLevel,
    getDetails: detailCapability.getDetails,
  });
  const actionCapability = createS3ActionCapability(
    client,
    getLevel,
    getBackStack,
    setBackStack,
    setLevel,
  );

  return {
    id: "s3",
    label: "S3",
    hudColor: SERVICE_COLORS.s3,
    getColumns,
    getRows,
    onSelect,
    canGoBack,
    goBack,
    getPath,
    getContextLabel,
    reset() {
      setLevel({ kind: "buckets" });
      setBackStack([]);
    },
    capabilities: {
      edit: editCapability,
      detail: detailCapability,
      yank: yankCapability,
      actions: actionCapability,
    },
  };
}
