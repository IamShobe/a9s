import type { EditCapability } from "../../../adapters/capabilities/EditCapability.js";
import type { TableRow, SelectResult } from "../../../types.js";
import { readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsEBSTag, AwsEBSVolume, EBSLevel, EBSRowMeta } from "../types.js";

export function createEBSEditCapability(
  region?: string,
  getLevel?: () => EBSLevel,
): EditCapability {
  const regionArgs = buildRegionArgs(region);

  const onEdit = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel?.();
    const meta = row.meta as EBSRowMeta | undefined;

    if (!meta || level?.kind !== "volumes" || meta.type !== "volume") {
      return { action: "none" };
    }

    const data = await runAwsJsonAsync<{ Volumes: AwsEBSVolume[] }>([
      "ec2",
      "describe-volumes",
      "--volume-ids",
      meta.volumeId,
      ...regionArgs,
    ]);
    const tags: AwsEBSTag[] = data.Volumes?.[0]?.Tags ?? [];
    const tagsObj = Object.fromEntries(tags.map((t) => [t.Key, t.Value]));

    const safeName = meta.volumeId.replace(/[^a-z0-9_-]/gi, "_");
    const filePath = join(tmpdir(), `a9s_ebs_tags_${safeName}.json`);
    await writeFile(filePath, JSON.stringify(tagsObj, null, 2), { mode: 0o600 });

    return {
      action: "edit",
      filePath,
      metadata: { volumeId: meta.volumeId, currentTags: tags },
    };
  };

  const uploadFile = async (filePath: string, metadata: Record<string, unknown>): Promise<void> => {
    const volumeId = metadata.volumeId as string | undefined;
    if (!volumeId) throw new Error("Missing volumeId in metadata");

    const newTagsJson = await readFile(filePath, "utf-8");
    let newTags: Record<string, string>;
    try {
      newTags = JSON.parse(newTagsJson) as Record<string, string>;
    } catch {
      throw new Error("Invalid JSON in tags file");
    }

    const currentTags = (metadata.currentTags as AwsEBSTag[] | undefined) ?? [];

    const tagsToDelete = currentTags.filter((t) => !(t.Key in newTags));
    if (tagsToDelete.length > 0) {
      await runAwsJsonAsync<unknown>([
        "ec2",
        "delete-tags",
        "--cli-input-json",
        JSON.stringify({
          Resources: [volumeId],
          Tags: tagsToDelete.map((t) => ({ Key: t.Key })),
        }),
        ...regionArgs,
      ]);
    }

    if (Object.keys(newTags).length > 0) {
      await runAwsJsonAsync<unknown>([
        "ec2",
        "create-tags",
        "--cli-input-json",
        JSON.stringify({
          Resources: [volumeId],
          Tags: Object.entries(newTags).map(([Key, Value]) => ({ Key, Value })),
        }),
        ...regionArgs,
      ]);
    }
  };

  return { onEdit, uploadFile };
}
