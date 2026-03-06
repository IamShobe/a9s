import { useCallback, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ServiceAdapter } from "../adapters/ServiceAdapter.js";
import type { TableRow } from "../types.js";
import { getCellValue } from "../types.js";
import type { DescribeState } from "./useAppController.js";

interface UseDetailControllerArgs {
  adapter: ServiceAdapter;
  setDescribeState: Dispatch<SetStateAction<DescribeState | null>>;
}

export function applyDetailSuccess(
  prev: DescribeState | null,
  requestId: number,
  fields: Array<{ label: string; value: string }>,
): DescribeState | null {
  if (!prev || prev.requestId !== requestId) return prev;
  return { ...prev, fields, loading: false };
}

export function applyDetailError(
  prev: DescribeState | null,
  requestId: number,
  selectedRow: TableRow,
  error: Error,
): DescribeState | null {
  if (!prev || prev.requestId !== requestId) return prev;
  return {
    ...prev,
    fields: [
      { label: "Name", value: selectedRow.cells.name ? getCellValue(selectedRow.cells.name) : selectedRow.id },
      { label: "Error", value: error.message },
    ],
    loading: false,
  };
}

export function useDetailController({ adapter, setDescribeState }: UseDetailControllerArgs) {
  const requestSeqRef = useRef(0);

  const showDetails = useCallback(
    (selectedRow: TableRow | null) => {
      if (!selectedRow) return;
      requestSeqRef.current += 1;
      const requestId = requestSeqRef.current;
      setDescribeState({ row: selectedRow, fields: null, loading: true, requestId });

      void (async () => {
        try {
          const fields = adapter.capabilities?.detail
            ? await adapter.capabilities.detail.getDetails(selectedRow)
            : [
                { label: "Name", value: selectedRow.cells.name ? getCellValue(selectedRow.cells.name) : selectedRow.id },
                { label: "Type", value: String(selectedRow.meta?.type ?? "Unknown") },
                { label: "Details", value: "Not available for this service" },
              ];

          setDescribeState((prev) => applyDetailSuccess(prev, requestId, fields));
        } catch (error) {
          setDescribeState((prev) =>
            applyDetailError(prev, requestId, selectedRow, error as Error),
          );
        }
      })();
    },
    [adapter, setDescribeState],
  );

  const closeDetails = useCallback(() => setDescribeState(null), [setDescribeState]);

  return {
    showDetails,
    closeDetails,
  };
}
