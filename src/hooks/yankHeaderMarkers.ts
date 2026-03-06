import type { YankOption } from "../adapters/capabilities/YankCapability.js";

export type HeaderMarkers = Record<string, string[]>;

export function deriveYankHeaderMarkers(
  yankMode: boolean,
  yankOptions: YankOption[],
): HeaderMarkers | undefined {
  if (!yankMode) return undefined;

  const map = new Map<string, string[]>();
  for (const option of yankOptions) {
    if (!option.headerKey) continue;
    if (option.trigger.type !== "key") continue;

    const token = option.trigger.char;
    const prev = map.get(option.headerKey) ?? [];
    if (!prev.includes(token)) {
      map.set(option.headerKey, [...prev, token]);
    }
  }

  if (map.size === 0) return undefined;

  const markers: HeaderMarkers = {};
  for (const [key, tokens] of map.entries()) {
    markers[key] = tokens;
  }
  return markers;
}
