import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";

export function safeString(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function formatDate(value: string | undefined): string {
  if (!value) return "-";
  return value.replace("T", " ").replace("Z", "");
}

export async function writeTempJsonFile(prefix: string, payload: unknown): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "a9s-iam-"));
  const filePath = join(dir, `${prefix}.json`);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}
