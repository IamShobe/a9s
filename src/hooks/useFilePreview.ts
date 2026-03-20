import { useState, useCallback } from "react";
import type { ColumnDef, TableRow } from "../types.js";
import type { ServiceAdapter } from "../adapters/ServiceAdapter.js";
import { useNavigation } from "./useNavigation.js";
import { debugLog } from "../utils/debugLogger.js";

const PAGE_SIZE = 10_000;

export interface FilePreviewState {
  fileName: string;
  columns: ColumnDef[];
  rows: TableRow[];
  totalRows: number;
  totalPages: number;
  currentPage: number;
  isLoading: boolean;
  error: string | null;
  filterText: string;
  filterActive: boolean;
}

interface UseFilePreviewReturn {
  previewState: FilePreviewState | null;
  previewNavigation: ReturnType<typeof useNavigation>;
  showPreview: (row: TableRow, adapter: ServiceAdapter) => void;
  closePreview: () => void;
  nextPage: () => void;
  prevPage: () => void;
  setFilterText: (text: string) => void;
  openFilter: () => void;
  closeFilter: () => void;
}

export function useFilePreview(tableHeight: number): UseFilePreviewReturn {
  const [previewState, setPreviewState] = useState<FilePreviewState | null>(null);

  const previewNavigation = useNavigation(
    previewState?.rows.length ?? 0,
    tableHeight,
  );

  const loadPage = useCallback(
    async (row: TableRow, adapter: ServiceAdapter, page: number) => {
      const preview = adapter.capabilities?.preview;
      if (!preview) return;
      setPreviewState((prev) =>
        prev ? { ...prev, isLoading: true, error: null } : null,
      );
      try {
        const result = await preview.getPage(row, page, PAGE_SIZE);
        setPreviewState((prev) => ({
          fileName: result.fileName,
          columns: result.columns,
          rows: result.rows,
          totalRows: result.totalRows,
          totalPages: result.totalPages,
          currentPage: result.page,
          isLoading: false,
          error: null,
          filterText: prev?.filterText ?? "",
          filterActive: prev?.filterActive ?? false,
        }));
        previewNavigation.reset();
      } catch (err) {
        debugLog("useFilePreview", "load error", err);
        setPreviewState((prev) =>
          prev
            ? { ...prev, isLoading: false, error: (err as Error).message }
            : null,
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previewNavigation.reset],
  );

  // Keep a ref to the current row/adapter for page navigation
  const [pageContext, setPageContext] = useState<{
    row: TableRow;
    adapter: ServiceAdapter;
  } | null>(null);

  const showPreview = useCallback(
    (row: TableRow, adapter: ServiceAdapter) => {
      setPageContext({ row, adapter });
      setPreviewState({
        fileName: "",
        columns: [],
        rows: [],
        totalRows: 0,
        totalPages: 1,
        currentPage: 0,
        isLoading: true,
        error: null,
        filterText: "",
        filterActive: false,
      });
      previewNavigation.reset();
      void loadPage(row, adapter, 0);
    },
    [loadPage, previewNavigation],
  );

  const closePreview = useCallback(() => {
    setPreviewState(null);
    setPageContext(null);
  }, []);

  const nextPage = useCallback(() => {
    if (!previewState || !pageContext) return;
    const next = previewState.currentPage + 1;
    if (next >= previewState.totalPages) return;
    void loadPage(pageContext.row, pageContext.adapter, next);
  }, [previewState, pageContext, loadPage]);

  const prevPage = useCallback(() => {
    if (!previewState || !pageContext) return;
    const prev = previewState.currentPage - 1;
    if (prev < 0) return;
    void loadPage(pageContext.row, pageContext.adapter, prev);
  }, [previewState, pageContext, loadPage]);

  const setFilterText = useCallback((text: string) => {
    setPreviewState((prev) => (prev ? { ...prev, filterText: text } : null));
    previewNavigation.reset();
  }, [previewNavigation]);

  const openFilter = useCallback(() => {
    setPreviewState((prev) => (prev ? { ...prev, filterActive: true } : null));
  }, []);

  const closeFilter = useCallback(() => {
    setPreviewState((prev) => (prev ? { ...prev, filterActive: false } : null));
  }, []);

  return {
    previewState,
    previewNavigation,
    showPreview,
    closePreview,
    nextPage,
    prevPage,
    setFilterText,
    openFilter,
    closeFilter,
  };
}
