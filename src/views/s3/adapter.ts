import type { ServiceAdapter, DetailField } from '../../adapters/ServiceAdapter.js';
import type { ColumnDef, TableRow, SelectResult, NavFrame } from '../../types.js';
import { createS3Client } from './client.js';
import { fetchBuckets, fetchObjects, downloadObject, headObject } from './fetcher.js';
import type { S3Client } from '@aws-sdk/client-s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile } from 'fs/promises';

type S3Level =
  | { kind: 'buckets' }
  | { kind: 'objects'; bucket: string; prefix: string };

interface S3NavFrame extends NavFrame {
  level: S3Level;
}

export class S3ServiceAdapter implements ServiceAdapter {
  id = 's3';
  label = 'S3';
  hudColor = { bg: 'red', fg: 'white' };

  private level: S3Level = { kind: 'buckets' };
  private backStack: S3NavFrame[] = [];
  private client: S3Client;

  constructor(endpointUrl?: string) {
    this.client = createS3Client(endpointUrl);
  }

  getColumns(): ColumnDef[] {
    if (this.level.kind === 'buckets') {
      return [
        { key: 'name', label: 'Name' },
        { key: 'creationDate', label: 'Creation Date', width: 22 },
      ];
    }
    return [
      { key: 'name', label: 'Name' },
      { key: 'size', label: 'Size', width: 12 },
      { key: 'lastModified', label: 'Last Modified', width: 22 },
    ];
  }

  async getRows(): Promise<TableRow[]> {
    if (this.level.kind === 'buckets') {
      const buckets = await fetchBuckets(this.client);
      return buckets.map((b) => ({
        id: b.name,
        cells: {
          name: b.name,
          creationDate: b.creationDate
            ? b.creationDate.toISOString().replace('T', ' ').slice(0, 19)
            : '-',
        },
        meta: { type: 'bucket' },
      }));
    }

    const { bucket, prefix } = this.level;
    const objects = await fetchObjects(this.client, bucket, prefix);
    return objects.map((obj) => {
      const displayKey = obj.key.slice(prefix.length);
      return {
        id: obj.key,
        cells: {
          name: displayKey,
          size: obj.isFolder ? '' : formatSize(obj.size),
          lastModified: obj.lastModified
            ? obj.lastModified.toISOString().replace('T', ' ').slice(0, 19)
            : '',
        },
        meta: { type: obj.isFolder ? 'folder' : 'object', key: obj.key },
      };
    });
  }

  async onSelect(row: TableRow): Promise<SelectResult> {
    if (this.level.kind === 'buckets') {
      this.backStack.push({ level: { kind: 'buckets' }, selectedIndex: 0 });
      this.level = { kind: 'objects', bucket: row.id, prefix: '' };
      return { action: 'navigate' };
    }

    const type = row.meta?.type as string;
    if (type === 'folder') {
      this.backStack.push({
        level: { ...this.level },
        selectedIndex: 0,
      });
      this.level = {
        kind: 'objects',
        bucket: this.level.bucket,
        prefix: row.meta?.key as string,
      };
      return { action: 'navigate' };
    }

    if (type === 'object') {
      const filePath = await downloadObject(
        this.client,
        this.level.bucket,
        row.meta?.key as string
      );
      return {
        action: 'edit',
        filePath,
        metadata: {
          bucket: this.level.bucket,
          key: row.meta?.key,
        },
      };
    }

    return { action: 'none' };
  }

  canGoBack(): boolean {
    return this.backStack.length > 0;
  }

  goBack(): void {
    const frame = this.backStack.pop()!;
    this.level = frame.level;
  }

  getPath(): string {
    if (this.level.kind === 'buckets') return '/';
    const { bucket, prefix } = this.level;
    return `/${bucket}/${prefix}`;
  }

  getContextLabel(): string {
    if (this.level.kind === 'buckets') {
      return '🪣 Buckets';
    }
    const prefix = this.level.prefix ? ` › ${this.level.prefix}` : '';
    return `📦 ${this.level.bucket}${prefix}`;
  }

  async uploadFile(filePath: string, metadata: Record<string, unknown>): Promise<void> {
    const bucket = metadata.bucket as string;
    const key = metadata.key as string;

    const fileContent = await readFile(filePath);

    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileContent,
      })
    );
  }

  async getDetails(row: TableRow): Promise<DetailField[]> {
    const type = row.meta?.type as string;

    if (type === 'bucket') {
      return [
        { label: 'Name', value: row.cells.name ?? '-' },
        { label: 'Type', value: 'Bucket' },
        { label: 'Created', value: row.cells.creationDate ?? '-' },
      ];
    }

    if (type === 'folder') {
      return [
        { label: 'Name', value: row.cells.name ?? '-' },
        { label: 'Type', value: 'Folder' },
        { label: 'Key', value: (row.meta?.key as string) ?? '-' },
      ];
    }

    // type === 'object'
    if (this.level.kind !== 'objects') return [];
    const key = row.meta?.key as string;
    const meta = await headObject(this.client, this.level.bucket, key);

    const fields: DetailField[] = [
      { label: 'Name', value: row.cells.name ?? '-' },
      { label: 'Key', value: key },
      { label: 'Size', value: row.cells.size ?? '-' },
      { label: 'Content-Type', value: meta.contentType ?? '-' },
      { label: 'ETag', value: meta.etag ?? '-' },
      { label: 'Last Modified', value: meta.lastModified ?? '-' },
      { label: 'Storage Class', value: meta.storageClass ?? '-' },
    ];

    if (meta.versionId) fields.push({ label: 'Version ID', value: meta.versionId });
    if (meta.serverSideEncryption) fields.push({ label: 'SSE', value: meta.serverSideEncryption });

    // User metadata (meta:* keys)
    for (const [k, v] of Object.entries(meta)) {
      if (k.startsWith('meta:') && v) {
        fields.push({ label: k.slice(5), value: v });
      }
    }

    return fields;
  }
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
