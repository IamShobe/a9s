import type { EditCapability } from "../../../adapters/capabilities/EditCapability.js";
import type { TableRow, SelectResult } from "../../../types.js";
import { readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { runAwsJsonAsync, buildRegionArgs } from "../../../utils/aws.js";
import type { AwsRDSTag, RDSLevel, RDSRowMeta } from "../types.js";

export function createRDSEditCapability(
  region?: string,
  getLevel?: () => RDSLevel,
): EditCapability {
  const regionArgs = buildRegionArgs(region);

  const onEdit = async (row: TableRow): Promise<SelectResult> => {
    const level = getLevel?.();
    const meta = row.meta as RDSRowMeta | undefined;

    if (!meta || level?.kind !== "instances" || meta.type !== "instance") {
      return { action: "none" };
    }

    const data = await runAwsJsonAsync<{ TagList: AwsRDSTag[] }>([
      "rds",
      "list-tags-for-resource",
      "--resource-name",
      meta.dbInstanceArn,
      ...regionArgs,
    ]);
    const tags: AwsRDSTag[] = data.TagList ?? [];
    const tagsObj = Object.fromEntries(tags.map((t) => [t.Key, t.Value]));

    const safeName = meta.dbInstanceIdentifier.replace(/[^a-z0-9_-]/gi, "_");
    const filePath = join(tmpdir(), `a9s_rds_tags_${safeName}.json`);
    await writeFile(filePath, JSON.stringify(tagsObj, null, 2), { mode: 0o600 });

    return {
      action: "edit",
      filePath,
      metadata: { dbInstanceArn: meta.dbInstanceArn, currentTags: tags },
    };
  };

  const uploadFile = async (filePath: string, metadata: Record<string, unknown>): Promise<void> => {
    const dbInstanceArn = metadata.dbInstanceArn as string | undefined;
    if (!dbInstanceArn) throw new Error("Missing dbInstanceArn in metadata");

    const newTagsJson = await readFile(filePath, "utf-8");
    let newTags: Record<string, string>;
    try {
      newTags = JSON.parse(newTagsJson) as Record<string, string>;
    } catch {
      throw new Error("Invalid JSON in tags file");
    }

    const currentTags = (metadata.currentTags as AwsRDSTag[] | undefined) ?? [];
    const keysToRemove = currentTags.filter((t) => !(t.Key in newTags)).map((t) => t.Key);

    if (keysToRemove.length > 0) {
      await runAwsJsonAsync<unknown>([
        "rds",
        "remove-tags-from-resource",
        "--resource-name",
        dbInstanceArn,
        "--tag-keys",
        ...keysToRemove,
        ...regionArgs,
      ]);
    }

    if (Object.keys(newTags).length > 0) {
      await runAwsJsonAsync<unknown>([
        "rds",
        "add-tags-to-resource",
        "--resource-name",
        dbInstanceArn,
        "--tags",
        ...Object.entries(newTags).map(([Key, Value]) => `Key=${Key},Value=${Value}`),
        ...regionArgs,
      ]);
    }
  };

  return { onEdit, uploadFile };
}
