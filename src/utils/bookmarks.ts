import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { z } from "zod";
import type { TableRow } from "../types.js";

const BOOKMARKS_DIR = join(homedir(), ".a9s");
const BOOKMARKS_FILE = join(BOOKMARKS_DIR, "bookmarks.json");
const MAX_BOOKMARKS = 200;

const BookmarkKeyPartSchema = z.object({
  label: z.string(),
  displayName: z.string(),
  id: z.string(),
});

const BookmarkEntrySchema = z.object({
  serviceId: z.string(),
  rowId: z.string(),
  key: z.array(BookmarkKeyPartSchema),
  rowArn: z.string().optional(),
  savedAt: z.string(),
});

export type BookmarkKeyPart = z.infer<typeof BookmarkKeyPartSchema>;
export type BookmarkEntry = z.infer<typeof BookmarkEntrySchema>;

export function singlePartKey(label: string, row: TableRow): BookmarkKeyPart[] {
  const nameCell = row.cells.name;
  const name = typeof nameCell === "object" ? (nameCell?.displayName ?? row.id) : (nameCell ?? row.id);
  return [{ label, displayName: name, id: row.id }];
}

export function getBookmarkDisplayName(entry: BookmarkEntry): string {
  return entry.key.map((p) => p.displayName).join(" › ");
}

function loadBookmarkData(): BookmarkEntry[] {
  try {
    const content = readFileSync(BOOKMARKS_FILE, "utf-8");
    const parsed: unknown = JSON.parse(content);
    const result = z.array(z.unknown()).safeParse(parsed);
    if (!result.success) return [];
    return result.data.flatMap((item) => {
      const entry = BookmarkEntrySchema.safeParse(item);
      return entry.success ? [entry.data] : [];
    });
  } catch {
    return [];
  }
}

function saveBookmarkData(entries: BookmarkEntry[]): void {
  try {
    mkdirSync(BOOKMARKS_DIR, { recursive: true });
    writeFileSync(BOOKMARKS_FILE, JSON.stringify(entries, null, 2), "utf-8");
  } catch {
    // Silently ignore write errors
  }
}

export function loadBookmarks(): BookmarkEntry[] {
  return loadBookmarkData();
}

export function isBookmarked(serviceId: string, rowId: string): boolean {
  return loadBookmarkData().some((e) => e.serviceId === serviceId && e.rowId === rowId);
}

export function toggleBookmark(entry: BookmarkEntry): boolean {
  const existing = loadBookmarkData();
  const idx = existing.findIndex((e) => e.serviceId === entry.serviceId && e.rowId === entry.rowId);
  if (idx >= 0) {
    existing.splice(idx, 1);
    saveBookmarkData(existing);
    return false; // was removed
  }
  const newEntries = [entry, ...existing].slice(0, MAX_BOOKMARKS);
  saveBookmarkData(newEntries);
  return true; // was added
}
