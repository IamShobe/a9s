import type { ServiceAdapter, RelatedResource } from "../../adapters/ServiceAdapter.js";
import type { ColumnDef, TableRow, SelectResult, NavFrame } from "../../types.js";
import { textCell } from "../../types.js";
import type { BookmarkKeyPart } from "../../utils/bookmarks.js";
import { createS3Client } from "./client.js";
import { fetchBuckets, fetchObjects, downloadObject } from "./fetcher.js";
import type { S3Client } from "@aws-sdk/client-s3";
import { createStackState } from "../../utils/createStackState.js";
import { resolveRegion } from "../../utils/aws.js";
import { formatSize } from "./utils.js";
import { createS3EditCapability } from "./capabilities/editCapability.js";
import { createS3DetailCapability } from "./capabilities/detailCapability.js";
import { createS3YankCapability } from "./capabilities/yankCapability.js";
import { createS3ActionCapability } from "./capabilities/actionCapability.js";
import { createS3PreviewCapability } from "./capabilities/previewCapability.js";
import { SERVICE_COLORS } from "../../constants/theme.js";

export type S3Level = { kind: "buckets" } | { kind: "objects"; bucket: string; prefix: string };

interface S3NavFrame extends NavFrame {
  level: S3Level;
}


export function createS3ServiceAdapter(endpointUrl?: string, region?: string): ServiceAdapter {
  const client: S3Client = createS3Client(endpointUrl, region);
  const { getLevel, setLevel, getBackStack, setBackStack, canGoBack, goBack, pushUiLevel, reset } = createStackState<S3Level, S3NavFrame>({ kind: "buckets" });

  const getColumns = (): ColumnDef[] => {
    const level = getLevel();
    if (level.kind === "buckets") {
      return [
        { key: "name", label: "Name" },
        { key: "type", label: "Type", width: 10 },
        { key: "creationDate", label: "Creation Date", width: 22, heatmap: { type: "date" } },
      ];
    }
    return [
      { key: "name", label: "Name" },
      { key: "type", label: "Type", width: 10 },
      { key: "size", label: "Size", width: 12, heatmap: { type: "numeric" } },
      { key: "lastModified", label: "Last Modified", width: 22, heatmap: { type: "date" } },
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

    const meta = row.meta as { type?: string; key?: string } | undefined;
    const type = meta?.type;
    if (type === "folder") {
      if (!meta?.key) return { action: "none" };
      const newStack = [...backStack, { level: level, selectedIndex: 0 }];
      setBackStack(newStack);
      setLevel({
        kind: "objects",
        bucket: level.bucket,
        prefix: meta.key,
      });
      return { action: "navigate" };
    }

    if (type === "object") {
      if (!meta?.key) return { action: "none" };
      const filePath = await downloadObject(client, level.bucket, meta.key);
      return {
        action: "edit",
        filePath,
        metadata: {
          bucket: level.bucket,
          key: meta.key,
        },
      };
    }

    return { action: "none" };
  };

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
  const previewCapability = createS3PreviewCapability(client, getLevel);

  const getRelatedResources = (row: TableRow): RelatedResource[] => {
    const level = getLevel();
    if (level.kind === "buckets") {
      const bucketName = row.id;
      return [
        { serviceId: "cloudwatch", label: `CloudWatch metrics for ${bucketName}`, filterHint: bucketName },
        { serviceId: "eventbridge", label: `EventBridge rules for ${bucketName}`, filterHint: bucketName },
      ];
    }
    return [];
  };

  const getBrowserUrl = (row: TableRow): string | null => {
    const level = getLevel();
    const r = resolveRegion(region);
    if (level.kind === "buckets") {
      return `https://s3.console.aws.amazon.com/s3/buckets/${row.id}?region=${r}`;
    }
    return `https://s3.console.aws.amazon.com/s3/object/${level.bucket}?region=${r}&prefix=${encodeURIComponent(row.id)}`;
  };

  return {
    id: "s3",
    label: "S3",
    hudColor: SERVICE_COLORS.s3,
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
      if (level.kind === "buckets") {
        return [{ label: "Bucket", displayName: row.id, id: row.id }];
      }
      // objects level
      const { bucket } = level;
      const fullKey = row.id;
      return [
        { label: "Bucket", displayName: bucket, id: bucket },
        { label: "Key", displayName: fullKey, id: fullKey },
      ];
    },
    restoreFromKey(key: BookmarkKeyPart[]): void {
      if (key.length === 1) {
        const bucket = key[0]!.id ?? key[0]!.displayName;
        setBackStack([{ level: { kind: "buckets" }, selectedIndex: 0 }]);
        setLevel({ kind: "objects", bucket, prefix: "" });
      } else if (key.length >= 2) {
        const bucket = key[0]!.id ?? key[0]!.displayName;
        const fullKey = key[1]!.id ?? key[1]!.displayName;
        // Derive prefix by stripping last segment
        const lastSlash = fullKey.lastIndexOf("/");
        const prefix = lastSlash >= 0 ? fullKey.slice(0, lastSlash + 1) : "";
        const parts = prefix.split("/").filter(Boolean);
        const backStack: S3NavFrame[] = [{ level: { kind: "buckets" }, selectedIndex: 0 }];
        for (let i = 0; i < parts.length; i++) {
          const framePrefix = i === 0 ? "" : parts.slice(0, i).join("/") + "/";
          backStack.push({ level: { kind: "objects", bucket, prefix: framePrefix }, selectedIndex: 0 });
        }
        setBackStack(backStack);
        setLevel({ kind: "objects", bucket, prefix });
      }
    },
    capabilities: {
      edit: editCapability,
      detail: detailCapability,
      yank: yankCapability,
      actions: actionCapability,
      preview: previewCapability,
    },
  };
}
