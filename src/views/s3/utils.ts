export function formatSize(bytes?: number): string {
  if (bytes === undefined) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function toParentPrefix(spec: string): string {
  if (!spec) return "";
  if (spec.endsWith("/")) return spec;
  const idx = spec.lastIndexOf("/");
  return idx >= 0 ? spec.slice(0, idx + 1) : "";
}
