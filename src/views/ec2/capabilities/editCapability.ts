import type { EditCapability } from "../../../adapters/capabilities/EditCapability.js";
import type { TableRow, SelectResult } from "../../../types.js";
import { readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsReservation, AwsTag, EC2Level, EC2RowMeta } from "../types.js";

export function createEC2EditCapability(
  region?: string,
  getLevel?: () => EC2Level,
): EditCapability {
  const regionArgs = buildRegionArgs(region);

  const onEdit = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel?.();
    const meta = row.meta as EC2RowMeta | undefined;

    if (!meta || level?.kind !== "instances" || meta.type !== "instance") {
      return { action: "none" };
    }

    // Fetch current tags as a key→value object
    const data = await runAwsJsonAsync<{ Reservations: AwsReservation[] }>([
      "ec2",
      "describe-instances",
      "--instance-ids",
      meta.instanceId,
      ...regionArgs,
    ]);
    const tags: AwsTag[] = data.Reservations?.[0]?.Instances?.[0]?.Tags ?? [];
    const tagsObj = Object.fromEntries(tags.map((t) => [t.Key, t.Value]));

    const safeName = meta.instanceId.replace(/[^a-z0-9_-]/gi, "_");
    const filePath = join(tmpdir(), `a9s_ec2_tags_${safeName}.json`);
    await writeFile(filePath, JSON.stringify(tagsObj, null, 2), { mode: 0o600 });

    return {
      action: "edit",
      filePath,
      metadata: { instanceId: meta.instanceId },
    };
  };

  const uploadFile = async (filePath: string, metadata: Record<string, unknown>): Promise<void> => {
    const instanceId = metadata.instanceId as string | undefined;
    if (!instanceId) throw new Error("Missing instanceId in metadata");

    const newTagsJson = await readFile(filePath, "utf-8");
    let newTags: Record<string, string>;
    try {
      newTags = JSON.parse(newTagsJson) as Record<string, string>;
    } catch {
      throw new Error("Invalid JSON in tags file");
    }

    // Fetch current tags to compute what needs to be removed
    const data = await runAwsJsonAsync<{ Reservations: AwsReservation[] }>([
      "ec2",
      "describe-instances",
      "--instance-ids",
      instanceId,
      ...regionArgs,
    ]);
    const currentTags: AwsTag[] = data.Reservations?.[0]?.Instances?.[0]?.Tags ?? [];

    // Delete tags that are no longer present
    const tagsToDelete = currentTags.filter((t) => !(t.Key in newTags));
    if (tagsToDelete.length > 0) {
      await runAwsJsonAsync<unknown>([
        "ec2",
        "delete-tags",
        "--cli-input-json",
        JSON.stringify({
          Resources: [instanceId],
          Tags: tagsToDelete.map((t) => ({ Key: t.Key })),
        }),
        ...regionArgs,
      ]);
    }

    // Create/update tags from the new file
    if (Object.keys(newTags).length > 0) {
      await runAwsJsonAsync<unknown>([
        "ec2",
        "create-tags",
        "--cli-input-json",
        JSON.stringify({
          Resources: [instanceId],
          Tags: Object.entries(newTags).map(([Key, Value]) => ({ Key, Value })),
        }),
        ...regionArgs,
      ]);
    }
  };

  return { onEdit, uploadFile };
}
