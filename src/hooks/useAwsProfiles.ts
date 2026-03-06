import { useEffect, useState } from "react";
import { runAwsCli } from "../utils/aws.js";

export interface AwsProfileOption {
  name: string;
  description: string;
}

const DEFAULT_PROFILE: AwsProfileOption = {
  name: "$default",
  description: "use process credentials/environment",
};

async function fetchProfiles(): Promise<AwsProfileOption[]> {
  const stdout = await runAwsCli(["configure", "list-profiles"], 3000);
  if (!stdout) return [DEFAULT_PROFILE];

  const profileNames = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (profileNames.length === 0) return [DEFAULT_PROFILE];

  const withMeta = await Promise.all(
    profileNames.map(async (name) => {
      const region = await runAwsCli(
        ["configure", "get", "region", "--profile", name],
        1500,
      );
      return {
        name,
        description: region?.trim() ? `region: ${region.trim()}` : "region: not set",
      };
    }),
  );

  const hasDefault = withMeta.some((p) => p.name === "$default");
  return hasDefault ? withMeta : [DEFAULT_PROFILE, ...withMeta];
}

export function useAwsProfiles(): AwsProfileOption[] {
  const [profiles, setProfiles] = useState<AwsProfileOption[]>([]);

  useEffect(() => {
    let alive = true;
    void fetchProfiles().then((result) => {
      if (alive) setProfiles(result);
    });
    return () => {
      alive = false;
    };
  }, []);

  return profiles;
}
