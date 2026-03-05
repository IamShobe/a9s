import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export interface S3Bucket {
  name: string;
  creationDate?: Date;
}

export interface S3Object {
  key: string;
  size?: number;
  lastModified?: Date;
  isFolder: boolean;
}

export async function fetchBuckets(client: S3Client): Promise<S3Bucket[]> {
  const response = await client.send(new ListBucketsCommand({}));
  return (response.Buckets ?? []).map((b) => ({
    name: b.Name ?? '',
    creationDate: b.CreationDate,
  }));
}

export async function fetchObjects(
  client: S3Client,
  bucket: string,
  prefix: string
): Promise<S3Object[]> {
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix || undefined,
      Delimiter: '/',
    })
  );

  const folders: S3Object[] = (response.CommonPrefixes ?? []).map((cp) => ({
    key: cp.Prefix ?? '',
    isFolder: true,
  }));

  const files: S3Object[] = (response.Contents ?? [])
    .filter((obj) => obj.Key !== prefix) // skip the "directory" marker itself
    .map((obj) => ({
      key: obj.Key ?? '',
      size: obj.Size,
      lastModified: obj.LastModified,
      isFolder: false,
    }));

  return [...folders, ...files];
}

export async function downloadObject(
  client: S3Client,
  bucket: string,
  key: string
): Promise<string> {
  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );

  if (!response.Body) throw new Error('Empty response body');

  const bytes = await response.Body.transformToByteArray();
  const safeName = key.replace(/\//g, '_');
  const filePath = join(tmpdir(), `a9s_${safeName}`);
  await writeFile(filePath, bytes);
  return filePath;
}

export async function headObject(
  client: S3Client,
  bucket: string,
  key: string
): Promise<Record<string, string | undefined>> {
  const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return {
    contentType: res.ContentType,
    contentLength: res.ContentLength?.toString(),
    etag: res.ETag?.replace(/"/g, ''),
    lastModified: res.LastModified?.toISOString().replace('T', ' ').slice(0, 19),
    storageClass: res.StorageClass ?? 'STANDARD',
    versionId: res.VersionId,
    serverSideEncryption: res.ServerSideEncryption,
    ...Object.fromEntries(
      Object.entries(res.Metadata ?? {}).map(([k, v]) => [`meta:${k}`, v])
    ),
  };
}
