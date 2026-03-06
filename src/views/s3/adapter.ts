import type {
  ServiceAdapter,
  DetailField,
} from "../../adapters/ServiceAdapter.js";
import type {
  ColumnDef,
  TableRow,
  SelectResult,
  NavFrame,
} from "../../types.js";
import { createS3Client } from "./client.js";
import {
  fetchBuckets,
  fetchObjects,
  downloadObject,
  downloadObjectToPath,
  headObject,
} from "./fetcher.js";
import type { S3Client } from "@aws-sdk/client-s3";
import {
  GetBucketAclCommand,
  GetBucketEncryptionCommand,
  GetBucketLocationCommand,
  GetBucketTaggingCommand,
  GetBucketVersioningCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { readFile } from "fs/promises";
import { atom } from "jotai";

type S3Level =
  | { kind: "buckets" }
  | { kind: "objects"; bucket: string; prefix: string };

interface S3NavFrame extends NavFrame {
  level: S3Level;
}

// S3 navigation atoms
export const s3LevelAtom = atom<S3Level>({ kind: "buckets" });
export const s3BackStackAtom = atom<S3NavFrame[]>([]);

export class S3ServiceAdapter implements ServiceAdapter {
  id = "s3";
  label = "S3";
  hudColor = { bg: "red", fg: "white" };
  private client: S3Client;
  private getLevel: () => S3Level;
  private setLevel: (level: S3Level) => void;
  private getBackStack: () => S3NavFrame[];
  private setBackStack: (stack: S3NavFrame[]) => void;

  constructor(
    endpointUrl: string | undefined,
    region: string | undefined,
    getLevel: () => S3Level,
    setLevel: (level: S3Level) => void,
    getBackStack: () => S3NavFrame[],
    setBackStack: (stack: S3NavFrame[]) => void,
  ) {
    this.client = createS3Client(endpointUrl, region);
    this.getLevel = getLevel;
    this.setLevel = setLevel;
    this.getBackStack = getBackStack;
    this.setBackStack = setBackStack;
  }

  getColumns(): ColumnDef[] {
    const level = this.getLevel();
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
  }

  async getRows(): Promise<TableRow[]> {
    const level = this.getLevel();
    if (level.kind === "buckets") {
      const buckets = await fetchBuckets(this.client);
      return buckets.map((b) => ({
        id: b.name,
        cells: {
          name: b.name,
          type: "Bucket",
          creationDate: b.creationDate
            ? b.creationDate.toISOString().replace("T", " ").slice(0, 19)
            : "-",
        },
        meta: { type: "bucket" },
      }));
    }

    const { bucket, prefix } = level;
    const objects = await fetchObjects(this.client, bucket, prefix);
    return objects.map((obj) => {
      const displayKey = obj.key.slice(prefix.length);
      return {
        id: obj.key,
        cells: {
          name: displayKey,
          type: obj.isFolder ? "Folder" : "File",
          size: obj.isFolder ? "" : formatSize(obj.size),
          lastModified: obj.lastModified
            ? obj.lastModified.toISOString().replace("T", " ").slice(0, 19)
            : "",
        },
        meta: { type: obj.isFolder ? "folder" : "object", key: obj.key },
      };
    });
  }

  async onSelect(row: TableRow): Promise<SelectResult> {
    const level = this.getLevel();
    const backStack = this.getBackStack();
    if (level.kind === "buckets") {
      const newStack = [...backStack, { level: level, selectedIndex: 0 }];
      this.setBackStack(newStack);
      this.setLevel({ kind: "objects", bucket: row.id, prefix: "" });
      return { action: "navigate" };
    }

    const type = row.meta?.type as string;
    if (type === "folder") {
      const newStack = [...backStack, { level: level, selectedIndex: 0 }];
      this.setBackStack(newStack);
      this.setLevel({
        kind: "objects",
        bucket: level.bucket,
        prefix: row.meta?.key as string,
      });
      return { action: "navigate" };
    }

    if (type === "object") {
      const filePath = await downloadObject(
        this.client,
        level.bucket,
        row.meta?.key as string,
      );
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
  }

  async onEdit(row: TableRow): Promise<SelectResult> {
    const level = this.getLevel();
    const type = row.meta?.type as string;
    if (level.kind !== "objects" || type !== "object") {
      return { action: "none" };
    }

    const filePath = await downloadObject(
      this.client,
      level.bucket,
      row.meta?.key as string,
    );
    return {
      action: "edit",
      filePath,
      metadata: {
        bucket: level.bucket,
        key: row.meta?.key,
      },
    };
  }

  canGoBack(): boolean {
    return this.getBackStack().length > 0;
  }

  goBack(): void {
    const backStack = this.getBackStack();
    if (backStack.length > 0) {
      const newStack = backStack.slice(0, -1);
      const frame = backStack[backStack.length - 1];
      this.setBackStack(newStack);
      this.setLevel(frame.level);
    }
  }

  getPath(): string {
    const level = this.getLevel();
    if (level.kind === "buckets") return "s3://";
    const { bucket, prefix } = level;
    return `s3://${bucket}/${prefix}`;
  }

  getContextLabel(): string {
    const level = this.getLevel();
    if (level.kind === "buckets") {
      return "🪣 Buckets";
    }
    const prefix = level.prefix ? ` › ${level.prefix}` : "";
    return `📦 ${level.bucket}${prefix}`;
  }

  async uploadFile(
    filePath: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const bucket = metadata.bucket as string;
    const key = metadata.key as string;

    const fileContent = await readFile(filePath);

    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileContent,
      }),
    );
  }

  async fetchTo(
    row: TableRow,
    destinationPath: string,
    overwrite = false,
  ): Promise<string> {
    const level = this.getLevel();
    if (level.kind !== "objects") {
      throw new Error("Fetch is only available in object view");
    }
    const type = row.meta?.type as string;
    if (type !== "object") {
      throw new Error("Fetch is only available for objects");
    }

    return downloadObjectToPath(
      this.client,
      level.bucket,
      row.meta?.key as string,
      destinationPath,
      overwrite,
    );
  }

  async jumpTo(target: string): Promise<void> {
    const raw = target.trim();
    if (!raw) {
      throw new Error("Jump target is empty");
    }

    const level = this.getLevel();
    const current = level;
    let nextBucket = "";
    let nextPrefix = "";

    if (raw.startsWith("s3://")) {
      const withoutScheme = raw.slice("s3://".length);
      const slashIdx = withoutScheme.indexOf("/");
      if (slashIdx === -1) {
        nextBucket = withoutScheme;
        nextPrefix = "";
      } else {
        nextBucket = withoutScheme.slice(0, slashIdx);
        const keySpec = withoutScheme.slice(slashIdx + 1);
        nextPrefix = toParentPrefix(keySpec);
      }
      if (!nextBucket) {
        throw new Error("Invalid S3 URI: missing bucket");
      }
    } else {
      if (level.kind !== "objects") {
        throw new Error('From bucket list, jump must use "s3://bucket/..."');
      }
      nextBucket = level.bucket;
      const localSpec = raw.startsWith("/") ? raw.slice(1) : raw;
      nextPrefix = toParentPrefix(localSpec);
    }

    const backStack = this.getBackStack();
    this.setBackStack([...backStack, { level: current, selectedIndex: 0 }]);
    this.setLevel({ kind: "objects", bucket: nextBucket, prefix: nextPrefix });
  }

  async getDetails(row: TableRow): Promise<DetailField[]> {
    const type = row.meta?.type as string;

    if (type === "bucket") {
      const bucket = row.cells.name ?? row.id;
      const fields: DetailField[] = [
        { label: "Name", value: row.cells.name ?? "-" },
        { label: "Type", value: "Bucket" },
        { label: "Created", value: row.cells.creationDate ?? "-" },
      ];

      const [
        locationResult,
        versioningResult,
        encryptionResult,
        taggingResult,
        aclResult,
        sampleObjectsResult,
      ] = await Promise.allSettled([
        this.client.send(new GetBucketLocationCommand({ Bucket: bucket })),
        this.client.send(new GetBucketVersioningCommand({ Bucket: bucket })),
        this.client.send(new GetBucketEncryptionCommand({ Bucket: bucket })),
        this.client.send(new GetBucketTaggingCommand({ Bucket: bucket })),
        this.client.send(new GetBucketAclCommand({ Bucket: bucket })),
        this.client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            MaxKeys: 1000,
          }),
        ),
      ]);

      if (locationResult.status === "fulfilled") {
        const raw = locationResult.value.LocationConstraint;
        const region = raw ?? "us-east-1";
        fields.push({ label: "Region", value: region });
      }

      if (versioningResult.status === "fulfilled") {
        fields.push({
          label: "Versioning",
          value: versioningResult.value.Status ?? "Disabled",
        });
      }

      if (encryptionResult.status === "fulfilled") {
        const rule =
          encryptionResult.value.ServerSideEncryptionConfiguration?.Rules?.[0];
        const algorithm =
          rule?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm;
        fields.push({
          label: "Default Encryption",
          value: algorithm ?? "Enabled (custom)",
        });
      } else {
        fields.push({ label: "Default Encryption", value: "Not configured" });
      }

      if (taggingResult.status === "fulfilled") {
        const tags = taggingResult.value.TagSet ?? [];
        fields.push({ label: "Tags", value: String(tags.length) });
        for (const tag of tags.slice(0, 5)) {
          fields.push({
            label: `tag:${tag.Key ?? "-"}`,
            value: tag.Value ?? "-",
          });
        }
        if (tags.length > 5) {
          fields.push({
            label: "tag:...",
            value: `+${tags.length - 5} more`,
          });
        }
      }

      if (aclResult.status === "fulfilled") {
        const grants = aclResult.value.Grants ?? [];
        fields.push({ label: "ACL Grants", value: String(grants.length) });
      }

      if (sampleObjectsResult.status === "fulfilled") {
        const objects = sampleObjectsResult.value.Contents ?? [];
        const objectCount = objects.length;
        const totalBytes = objects.reduce(
          (sum, obj) => sum + (obj.Size ?? 0),
          0,
        );
        fields.push({ label: "Objects (sample)", value: String(objectCount) });
        fields.push({
          label: "Size (sample)",
          value: formatSize(totalBytes),
        });
        if (sampleObjectsResult.value.IsTruncated) {
          fields.push({
            label: "Sample Note",
            value: "First 1000 objects only",
          });
        }
      }

      return fields;
    }

    if (type === "folder") {
      return [
        { label: "Name", value: row.cells.name ?? "-" },
        { label: "Type", value: "Folder" },
        { label: "Key", value: (row.meta?.key as string) ?? "-" },
      ];
    }

    // type === 'object'
    const level = this.getLevel();
    if (level.kind !== "objects") return [];
    const key = row.meta?.key as string;
    const meta = await headObject(this.client, level.bucket, key);

    const fields: DetailField[] = [
      { label: "Name", value: row.cells.name ?? "-" },
      { label: "Key", value: key },
      { label: "Size", value: row.cells.size ?? "-" },
      { label: "Content-Type", value: meta.contentType ?? "-" },
      { label: "ETag", value: meta.etag ?? "-" },
      { label: "Last Modified", value: meta.lastModified ?? "-" },
      { label: "Storage Class", value: meta.storageClass ?? "-" },
    ];

    if (meta.versionId)
      fields.push({ label: "Version ID", value: meta.versionId });
    if (meta.serverSideEncryption)
      fields.push({ label: "SSE", value: meta.serverSideEncryption });

    // User metadata (meta:* keys)
    for (const [k, v] of Object.entries(meta)) {
      if (k.startsWith("meta:") && v) {
        fields.push({ label: k.slice(5), value: v });
      }
    }

    return fields;
  }
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function toParentPrefix(spec: string): string {
  if (!spec) return "";
  if (spec.endsWith("/")) return spec;
  const idx = spec.lastIndexOf("/");
  return idx >= 0 ? spec.slice(0, idx + 1) : "";
}
