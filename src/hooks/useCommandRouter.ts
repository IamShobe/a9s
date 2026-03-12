import { useCallback } from "react";
import { SERVICE_REGISTRY } from "../services.js";
import type { ServiceId } from "../services.js";

export type ParsedCommand =
  | { type: "openProfiles" }
  | { type: "openRegions" }
  | { type: "openResources" }
  | { type: "openThemePicker" }
  | { type: "setRegion"; region: string }
  | { type: "setProfile"; profile: string }
  | { type: "setWatch"; seconds: number }
  | { type: "clearWatch" }
  | { type: "setTagFilter"; key: string; value: string }
  | { type: "clearTagFilter" }
  | { type: "quit" }
  | { type: "switchService"; serviceId: ServiceId }
  | { type: "unknown" };

export function parseCommand(input: string): ParsedCommand {
  const command = input.trim();
  if (command === "profiles") return { type: "openProfiles" };
  if (command === "regions") return { type: "openRegions" };
  if (command === "resources") return { type: "openResources" };
  if (command === "theme") return { type: "openThemePicker" };

  if (command === "unwatch") return { type: "clearWatch" };

  if (command === "untag") return { type: "clearTagFilter" };

  const tagMatch = command.match(/^tag\s+([^=\s]+)=(.+)$/i);
  if (tagMatch?.[1] && tagMatch?.[2]) {
    return { type: "setTagFilter", key: tagMatch[1], value: tagMatch[2].trim() };
  }

  const watchMatch = command.match(/^watch(?:\s+(\d+))?$/i);
  if (watchMatch) {
    const seconds = watchMatch[1] ? parseInt(watchMatch[1], 10) : 5;
    return { type: "setWatch", seconds: Math.max(1, Math.min(3600, seconds)) };
  }

  const regionMatch = command.match(/^(region|use-region)\s+([a-z0-9-]+)$/i);
  if (regionMatch?.[2]) {
    return { type: "setRegion", region: regionMatch[2].toLowerCase() };
  }

  const profileMatch = command.match(/^(profile|use-profile)\s+(.+)$/i);
  if (profileMatch?.[2]) {
    return { type: "setProfile", profile: profileMatch[2].trim() };
  }

  if (command === "quit" || command === "q") {
    return { type: "quit" };
  }

  if (command in SERVICE_REGISTRY) {
    return { type: "switchService", serviceId: command as ServiceId };
  }

  return { type: "unknown" };
}

interface UseCommandRouterArgs {
  setSelectedRegion: (region: string) => void;
  setSelectedProfile: (profile: string) => void;
  switchAdapter: (serviceId: ServiceId) => void;
  openProfilePicker: () => void;
  openRegionPicker: () => void;
  openResourcePicker: () => void;
  openThemePicker: () => void;
  setWatch: (seconds: number) => void;
  clearWatch: () => void;
  setTagFilter: (key: string, value: string) => void;
  clearTagFilter: () => void;
  exit: () => void;
}

export function useCommandRouter({
  setSelectedRegion,
  setSelectedProfile,
  switchAdapter,
  openProfilePicker,
  openRegionPicker,
  openResourcePicker,
  openThemePicker,
  setWatch,
  clearWatch,
  setTagFilter,
  clearTagFilter,
  exit,
}: UseCommandRouterArgs) {
  return useCallback(
    (input: string) => {
      const parsed = parseCommand(input);
      switch (parsed.type) {
        case "openProfiles":
          openProfilePicker();
          return;
        case "openRegions":
          openRegionPicker();
          return;
        case "openResources":
          openResourcePicker();
          return;
        case "openThemePicker":
          openThemePicker();
          return;
        case "setRegion":
          setSelectedRegion(parsed.region);
          return;
        case "setProfile":
          setSelectedProfile(parsed.profile);
          return;
        case "setWatch":
          setWatch(parsed.seconds);
          return;
        case "clearWatch":
          clearWatch();
          return;
        case "setTagFilter":
          setTagFilter(parsed.key, parsed.value);
          return;
        case "clearTagFilter":
          clearTagFilter();
          return;
        case "quit":
          exit();
          return;
        case "switchService":
          switchAdapter(parsed.serviceId);
          return;
        case "unknown":
          return;
      }
    },
    [setSelectedRegion, setSelectedProfile, switchAdapter, openProfilePicker, openRegionPicker, openResourcePicker, openThemePicker, setWatch, clearWatch, setTagFilter, clearTagFilter, exit],
  );
}
