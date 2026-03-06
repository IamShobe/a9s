import fs from "fs";
import path from "path";
import os from "os";
import * as YAML from "yaml";
import { z } from "zod";
import { THEMES } from "../constants/theme.js";
import type { ThemeName } from "../constants/theme.js";

const CONFIG_DIR = path.join(os.homedir(), ".config", "a9s");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.yaml");

const THEME_NAMES = Object.keys(THEMES) as [ThemeName, ...ThemeName[]];

const A9sConfigSchema = z.object({
  theme: z.enum(THEME_NAMES).optional(),
});

export type A9sConfig = z.infer<typeof A9sConfigSchema>;

export function loadConfig(): A9sConfig {
  try {
    const raw = YAML.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    return A9sConfigSchema.parse(raw);
  } catch {
    return {};
  }
}

export function saveConfig(update: Partial<A9sConfig>): void {
  try {
    let existing: A9sConfig = {};
    try {
      const raw = YAML.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      existing = A9sConfigSchema.parse(raw);
    } catch {}
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, YAML.stringify({ ...existing, ...update }));
  } catch {
    // Best-effort — silently ignore write failures
  }
}
