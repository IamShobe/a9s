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

function createCache<T>(fetchFn: () => Promise<T>) {
  let cached: T | null = null;
  let pending: Promise<T> | null = null;
  return {
    peek: (): T | null => cached,
    get: async (): Promise<T> => {
      if (cached !== null) return cached;
      if (!pending) pending = fetchFn().then((r) => { cached = r; return r; });
      return pending;
    },
    clear: () => { cached = null; pending = null; },
  };
}

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

const profilesCache = createCache(fetchProfiles);

export function useAwsProfiles(): AwsProfileOption[] {
  const [profiles, setProfiles] = useState<AwsProfileOption[]>(() => profilesCache.peek() ?? []);

  useEffect(() => {
    let alive = true;

    const immediate = profilesCache.peek();
    if (immediate) {
      setProfiles(immediate);
      return () => { alive = false; };
    }

    setProfiles([DEFAULT_PROFILE]);

    void profilesCache.get().then((result) => {
      if (alive) setProfiles(result);
    });

    return () => { alive = false; };
  }, []);

  return profiles;
}
