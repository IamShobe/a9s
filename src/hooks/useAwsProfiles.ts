import { execFile } from "child_process";
import { promisify } from "util";
import { useEffect, useState } from "react";

const execFileAsync = promisify(execFile);

export interface AwsProfileOption {
  name: string;
  description: string;
}

let cachedProfiles: AwsProfileOption[] | null = null;
let pendingProfilesPromise: Promise<AwsProfileOption[]> | null = null;

async function getProfileRegion(profile: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(
      "aws",
      ["configure", "get", "region", "--profile", profile],
      { timeout: 1500, env: process.env },
    );
    const region = stdout.trim();
    return region || null;
  } catch {
    return null;
  }
}

async function fetchProfiles(): Promise<AwsProfileOption[]> {
  try {
    const { stdout } = await execFileAsync("aws", ["configure", "list-profiles"], {
      timeout: 3000,
      env: process.env,
    });

    const profileNames = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (profileNames.length > 0) {
      const withMeta = await Promise.all(
        profileNames.map(async (name) => {
          const region = await getProfileRegion(name);
          return {
            name,
            description: region ? `region: ${region}` : "region: not set",
          };
        }),
      );
      return withMeta;
    }
  } catch {
    // ignore and fall through to fallback
  }

  return [
    {
      name: "$default",
      description: "use process credentials/environment",
    },
  ];
}

export function useAwsProfiles(): AwsProfileOption[] {
  const [profiles, setProfiles] = useState<AwsProfileOption[]>(
    cachedProfiles ?? [],
  );

  useEffect(() => {
    let alive = true;

    if (cachedProfiles) {
      const hasDefault = cachedProfiles.some((p) => p.name === "$default");
      setProfiles(
        hasDefault
          ? cachedProfiles
          : [
              { name: "$default", description: "use process credentials/environment" },
              ...cachedProfiles,
            ],
      );
      return () => {
        alive = false;
      };
    }

    if (!pendingProfilesPromise) {
      pendingProfilesPromise = fetchProfiles().then((result) => {
        cachedProfiles = result;
        return result;
      });
    }

    void pendingProfilesPromise.then((result) => {
      if (!alive) return;
      const hasDefault = result.some((p) => p.name === "$default");
      const withDefault = hasDefault
        ? result
        : [
            { name: "$default", description: "use process credentials/environment" },
            ...result,
          ];
      setProfiles(withDefault);
      cachedProfiles = withDefault;
    });

    return () => {
      alive = false;
    };
  }, []);

  return profiles;
}
