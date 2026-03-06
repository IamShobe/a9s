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

let cachedProfiles: AwsProfileOption[] | null = null;
let pendingProfilesPromise: Promise<AwsProfileOption[]> | null = null;

async function fetchProfiles(): Promise<AwsProfileOption[]> {
  const stdout = await runAwsCli(["configure", "list-profiles"], 3000);
  if (!stdout) return [DEFAULT_PROFILE];

  const profileNames = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (profileNames.length === 0) return [DEFAULT_PROFILE];

  // Keep startup snappy: avoid N additional AWS CLI calls for region enrichment here.
  const withMeta = profileNames.map((name) => ({
    name,
    description: "configured profile",
  }));

  const hasDefault = withMeta.some((p) => p.name === "$default");
  return hasDefault ? withMeta : [DEFAULT_PROFILE, ...withMeta];
}

export function useAwsProfiles(): AwsProfileOption[] {
  const [profiles, setProfiles] = useState<AwsProfileOption[]>([]);

  useEffect(() => {
    let alive = true;

    if (cachedProfiles) {
      setProfiles(cachedProfiles);
      return () => {
        alive = false;
      };
    }

    setProfiles([DEFAULT_PROFILE]);

    if (!pendingProfilesPromise) {
      pendingProfilesPromise = fetchProfiles().then((result) => {
        cachedProfiles = result;
        return result;
      });
    }

    void pendingProfilesPromise.then((result) => {
      if (alive) setProfiles(result);
    });

    return () => {
      alive = false;
    };
  }, []);

  return profiles;
}
