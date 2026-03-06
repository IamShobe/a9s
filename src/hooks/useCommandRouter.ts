import { useCallback } from "react";
import { SERVICE_REGISTRY } from "../services.js";
import type { ServiceId } from "../services.js";

export type ParsedCommand =
  | { type: "openProfiles" }
  | { type: "openRegions" }
  | { type: "openResources" }
  | { type: "setRegion"; region: string }
  | { type: "setProfile"; profile: string }
  | { type: "quit" }
  | { type: "switchService"; serviceId: ServiceId }
  | { type: "unknown" };

export function parseCommand(input: string): ParsedCommand {
  const command = input.trim();
  if (command === "profiles") return { type: "openProfiles" };
  if (command === "regions") return { type: "openRegions" };
  if (command === "resources") return { type: "openResources" };

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
  exit: () => void;
}

export function useCommandRouter(args: UseCommandRouterArgs) {
  return useCallback(
    (input: string) => {
      const parsed = parseCommand(input);
      switch (parsed.type) {
        case "openProfiles":
          args.openProfilePicker();
          return;
        case "openRegions":
          args.openRegionPicker();
          return;
        case "openResources":
          args.openResourcePicker();
          return;
        case "setRegion":
          args.setSelectedRegion(parsed.region);
          return;
        case "setProfile":
          args.setSelectedProfile(parsed.profile);
          return;
        case "quit":
          args.exit();
          return;
        case "switchService":
          args.switchAdapter(parsed.serviceId);
          return;
        case "unknown":
          return;
      }
    },
    [args],
  );
}
