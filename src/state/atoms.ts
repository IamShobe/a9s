import { atom } from "jotai";
import type { AppMode } from "../types.js";
import type { ServiceId } from "../services.js";

/** Persists across HMR / re-renders. Currently selected AWS service. */
export const currentlySelectedServiceAtom = atom<ServiceId>("s3");

/** Current UI mode (navigate / search / command). */
export const modeAtom = atom<AppMode>("navigate");

/** Active filter text applied to the current view. */
export const filterTextAtom = atom("");

/** Text typed in command mode. */
export const commandTextAtom = atom("");

/** Navigation history: parallel stacks of filter texts and selected indices per level. */
export const hierarchyStateAtom = atom<{ filters: string[]; indices: number[] }>({
  filters: [""],
  indices: [0],
});

/** Selected AWS region. Falls back to env vars or us-east-1. */
export const selectedRegionAtom = atom(
  process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1",
);

/** Selected AWS profile. "$default" means use ambient credentials. */
export const selectedProfileAtom = atom(process.env.AWS_PROFILE ?? "$default");

/** Derived atom: adapter session ID. Changes atomically when service/region/profile change. */
export const adapterSessionAtom = atom((get) => {
  const service = get(currentlySelectedServiceAtom);
  const region = get(selectedRegionAtom);
  const profile = get(selectedProfileAtom);
  return `${service}:${region}:${profile}`;
});
