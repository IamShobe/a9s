import { useState } from "react";
import type { TableRow } from "../types.js";

export interface FetchPrompt {
  row: TableRow;
  destinationPath: string;
}

export interface FetchOverwritePending {
  row: TableRow;
  destinationPath: string;
  finalPath: string;
}

export function useFetchFlow() {
  const [fetchPrompt, setFetchPrompt] = useState<FetchPrompt | null>(null);
  const [fetchOverwritePending, setFetchOverwritePending] =
    useState<FetchOverwritePending | null>(null);

  return {
    fetchPrompt,
    setFetchPrompt,
    fetchOverwritePending,
    setFetchOverwritePending,
  };
}
