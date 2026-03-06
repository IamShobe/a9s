import { execFile } from "child_process";
import { promisify } from "util";
import { useEffect, useState } from "react";

const execFileAsync = promisify(execFile);

const STATIC_FALLBACK_REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ca-central-1",
  "ca-west-1",
  "sa-east-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-central-1",
  "eu-central-2",
  "eu-north-1",
  "eu-south-1",
  "eu-south-2",
  "af-south-1",
  "ap-south-1",
  "ap-south-2",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-southeast-3",
  "ap-southeast-4",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-northeast-3",
  "me-south-1",
  "me-central-1",
  "il-central-1",
] as const;

let cachedRegions: string[] | null = null;
let pendingRegionsPromise: Promise<string[]> | null = null;

export interface AwsRegionOption {
  name: string;
  description: string;
}

async function fetchRegions(profile?: string, region?: string): Promise<string[]> {
  const args = [
    "ec2",
    "describe-regions",
    "--all-regions",
    "--query",
    "Regions[].RegionName",
    "--output",
    "json",
  ];

  const env = { ...process.env };
  if (profile) env.AWS_PROFILE = profile;
  if (region) env.AWS_REGION = region;

  try {
    const { stdout } = await execFileAsync("aws", args, {
      timeout: 3000,
      env,
    });
    const parsed = JSON.parse(stdout) as unknown;
    if (Array.isArray(parsed)) {
      const normalized = parsed
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      if (normalized.length > 0) return normalized;
    }
  } catch {
    // fall back below
  }

  return [...STATIC_FALLBACK_REGIONS];
}

export function useAwsRegions(
  selectedRegion?: string,
  selectedProfile?: string,
): AwsRegionOption[] {
  const isLocal = Boolean(process.env.AWS_ENDPOINT_URL);
  const toOptions = (regions: string[]): AwsRegionOption[] =>
    regions.map((name) => ({
      name,
      description: isLocal ? "Local endpoint / emulated" : "AWS commercial region",
    }));
  const [regionOptions, setRegionOptions] = useState<AwsRegionOption[]>(
    toOptions(cachedRegions ?? [...STATIC_FALLBACK_REGIONS]),
  );

  const explicitProfile =
    selectedProfile && selectedProfile !== "$default" ? selectedProfile : undefined;

  useEffect(() => {
    let alive = true;

    if (cachedRegions) {
      setRegionOptions(toOptions(cachedRegions));
      return () => {
        alive = false;
      };
    }

    if (!pendingRegionsPromise) {
      pendingRegionsPromise = fetchRegions(
        explicitProfile ?? process.env.AWS_PROFILE,
        selectedRegion ?? process.env.AWS_REGION,
      ).then((result) => {
        cachedRegions = result;
        return result;
      });
    }

    void pendingRegionsPromise.then((result) => {
      if (!alive) return;
      setRegionOptions(toOptions(result));
    });

    return () => {
      alive = false;
    };
  }, [explicitProfile, selectedRegion]);

  return regionOptions;
}
