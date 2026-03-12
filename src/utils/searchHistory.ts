import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const HISTORY_DIR = join(homedir(), ".a9s");
const HISTORY_FILE = join(HISTORY_DIR, "search-history.json");
const MAX_ENTRIES = 50;

type SearchHistoryData = Record<string, string[]>; // serviceId → queries

function loadHistoryData(): SearchHistoryData {
  try {
    const content = readFileSync(HISTORY_FILE, "utf-8");
    return JSON.parse(content) as SearchHistoryData;
  } catch {
    return {};
  }
}

function saveHistoryData(data: SearchHistoryData): void {
  try {
    mkdirSync(HISTORY_DIR, { recursive: true });
    writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // Silently ignore write errors
  }
}

export function loadSearchHistory(serviceId: string): string[] {
  const data = loadHistoryData();
  return data[serviceId] ?? [];
}

export function saveSearchEntry(serviceId: string, query: string): void {
  if (!query.trim()) return;
  const data = loadHistoryData();
  const existing = data[serviceId] ?? [];
  const deduped = existing.filter((q) => q !== query);
  data[serviceId] = [query, ...deduped].slice(0, MAX_ENTRIES);
  saveHistoryData(data);
}
