import type { S3Client } from "@aws-sdk/client-s3";
import {
  GetBucketAclCommand,
  GetBucketEncryptionCommand,
  GetBucketLocationCommand,
  GetBucketPolicyStatusCommand,
  GetPublicAccessBlockCommand,
  GetBucketTaggingCommand,
  GetBucketVersioningCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

import type {
  DetailCapability,
  DetailField,
} from "../../../adapters/capabilities/DetailCapability.js";
import type { TableRow } from "../../../types.js";
import { formatSize } from "../utils.js";
import { headObject } from "../fetcher.js";
import type { S3Level } from "../adapter.js";

export function createS3DetailCapability(
  client: S3Client,
  getLevel: () => S3Level,
): DetailCapability {
  const getDetails = async (row: TableRow): Promise<DetailField[]> => {
    const cells = row.cells;
    const type = row.meta?.type as string;

    if (type === "bucket") {
      const bucket = cells.name?.displayName ?? row.id;
      const fields: DetailField[] = [
        { label: "Name", value: cells.name?.displayName ?? "-" },
        { label: "Type", value: "Bucket" },
        { label: "Created", value: cells.creationDate?.displayName ?? "-" },
      ];

      const [
        locationResult,
        versioningResult,
        encryptionResult,
        taggingResult,
        aclResult,
        publicAccessBlockResult,
        policyStatusResult,
        sampleObjectsResult,
      ] = await Promise.allSettled([
        client.send(new GetBucketLocationCommand({ Bucket: bucket })),
        client.send(new GetBucketVersioningCommand({ Bucket: bucket })),
        client.send(new GetBucketEncryptionCommand({ Bucket: bucket })),
        client.send(new GetBucketTaggingCommand({ Bucket: bucket })),
        client.send(new GetBucketAclCommand({ Bucket: bucket })),
        client.send(new GetPublicAccessBlockCommand({ Bucket: bucket })),
        client.send(new GetBucketPolicyStatusCommand({ Bucket: bucket })),
        client.send(
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
        const rule = encryptionResult.value.ServerSideEncryptionConfiguration?.Rules?.[0];
        const algorithm = rule?.ApplyServerSideEncryptionByDefault?.SSEAlgorithm;
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

      if (publicAccessBlockResult.status === "fulfilled") {
        const cfg = publicAccessBlockResult.value.PublicAccessBlockConfiguration;
        fields.push({ label: "--- Permissions ---", value: "" });
        fields.push({
          label: "Block Public ACLs",
          value: cfg?.BlockPublicAcls ? "Yes" : "No",
        });
        fields.push({
          label: "Ignore Public ACLs",
          value: cfg?.IgnorePublicAcls ? "Yes" : "No",
        });
        fields.push({
          label: "Block Public Policy",
          value: cfg?.BlockPublicPolicy ? "Yes" : "No",
        });
        fields.push({
          label: "Restrict Public Buckets",
          value: cfg?.RestrictPublicBuckets ? "Yes" : "No",
        });
      }

      if (policyStatusResult.status === "fulfilled") {
        fields.push({
          label: "Bucket Policy Public",
          value: policyStatusResult.value.PolicyStatus?.IsPublic ? "Yes" : "No",
        });
      }

      if (aclResult.status === "fulfilled") {
        const grants = aclResult.value.Grants ?? [];
        fields.push({ label: "ACL Grants", value: String(grants.length) });
        for (const grant of grants) {
          const grantee =
            grant.Grantee?.DisplayName ??
            grant.Grantee?.URI?.split("/").pop() ??
            grant.Grantee?.EmailAddress ??
            grant.Grantee?.ID?.slice(0, 12) ??
            "-";
          fields.push({
            label: `acl:${grantee}`,
            value: grant.Permission ?? "-",
          });
        }
      }

      if (sampleObjectsResult.status === "fulfilled") {
        const objects = sampleObjectsResult.value.Contents ?? [];
        const objectCount = objects.length;
        const totalBytes = objects.reduce((sum, obj) => sum + (obj.Size ?? 0), 0);
        fields.push({ label: "Objects (sample)", value: String(objectCount) });
        fields.push({ label: "Size (sample)", value: formatSize(totalBytes) });
        if (sampleObjectsResult.value.IsTruncated) {
          fields.push({ label: "Sample Note", value: "First 1000 objects only" });
        }
      }

      return fields;
    }

    if (type === "folder") {
      return [
        { label: "Name", value: row.cells.name?.displayName ?? "-" },
        { label: "Type", value: "Folder" },
        { label: "Key", value: (row.meta?.key as string) ?? "-" },
      ];
    }

    const level = getLevel();
    if (level.kind !== "objects") return [];
    const key = row.meta?.key as string;
    const meta = await headObject(client, level.bucket, key);

    const fields: DetailField[] = [
      { label: "Name", value: row.cells.name?.displayName ?? "-" },
      { label: "Key", value: key },
      { label: "Size", value: row.cells.size?.displayName ?? "-" },
      { label: "Content-Type", value: meta.contentType ?? "-" },
      { label: "ETag", value: meta.etag ?? "-" },
      { label: "Last Modified", value: meta.lastModified ?? "-" },
      { label: "Storage Class", value: meta.storageClass ?? "-" },
    ];

    if (meta.versionId) fields.push({ label: "Version ID", value: meta.versionId });
    if (meta.serverSideEncryption) fields.push({ label: "SSE", value: meta.serverSideEncryption });

    for (const [k, v] of Object.entries(meta)) {
      if (k.startsWith("meta:") && v) {
        fields.push({ label: k.slice(5), value: v });
      }
    }

    return fields;
  };

  return {
    getDetails,
  };
}
