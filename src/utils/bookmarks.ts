import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const BOOKMARKS_DIR = join(homedir(), ".a9s");
const BOOKMARKS_FILE = join(BOOKMARKS_DIR, "bookmarks.json");
const MAX_BOOKMARKS = 200;

export interface BookmarkEntry {
  serviceId: string;
  rowId: string;
  rowLabel: string;
  rowArn?: string;
  savedAt: string; // ISO date
}

function loadBookmarkData(): BookmarkEntry[] {
  try {
    const content = readFileSync(BOOKMARKS_FILE, "utf-8");
    return JSON.parse(content) as BookmarkEntry[];
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
