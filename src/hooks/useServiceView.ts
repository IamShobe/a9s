import { useCallback, useEffect, useLayoutEffect, useReducer } from 'react';
import { useAtomValue } from 'jotai';
import open from 'open';
import { extname } from 'path';
import { execSync } from 'child_process';
import { stat } from 'fs/promises';
import type { ServiceAdapter } from '../adapters/ServiceAdapter.js';
import type { TableRow, ColumnDef, SelectResult, ServiceViewResult } from '../types.js';
import { debugLog } from '../utils/debugLogger.js';
import { adapterSessionAtom } from '../state/atoms.js';

const TEXT_EXTENSIONS = new Set([
  '.txt', '.json', '.yaml', '.yml', '.xml', '.html', '.htm',
  '.css', '.js', '.ts', '.tsx', '.jsx', '.py', '.rb', '.go',
  '.java', '.c', '.cpp', '.h', '.sh', '.bash', '.zsh', '.fish',
  '.md', '.markdown', '.rst', '.sql', '.sql', '.toml', '.ini',
  '.env', '.log', '.csv', '.tsv', '.properties', '.gradle',
  '.maven', '.dockerfile', '.gitignore', '.npmrc', '.editorconfig',
]);

function isTextFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || !ext;
}

async function openFile(filePath: string): Promise<void> {
  try {
    if (isTextFile(filePath)) {
      const editor = process.env['EDITOR'] || 'vim';
      // execSync blocks and lets editor take full control of terminal
      // Ink will automatically suspend and resume when this completes
      execSync(`${editor} "${filePath}"`, { stdio: 'inherit' });
    } else {
      await open(filePath);
    }
  } catch (err) {
    console.error('Failed to open file:', (err as Error).message);
  }
}

interface DataState {
  adapterId: string;
  rows: TableRow[];
  columns: ColumnDef[];
  loadingCount: number;
  error: string | null;
}

type DataAction =
  | { type: 'ADAPTER_CHANGED'; adapterId: string }
  | { type: 'BEGIN_LOADING' }
  | { type: 'END_LOADING' }
  | { type: 'SET_DATA'; rows: TableRow[]; columns: ColumnDef[] }
  | { type: 'SET_ERROR'; error: string | null };

function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case 'ADAPTER_CHANGED':
      return {
        adapterId: action.adapterId,
        rows: [],
        columns: [],
        loadingCount: 0,
        error: null,
      };
    case 'BEGIN_LOADING':
      return { ...state, loadingCount: state.loadingCount + 1 };
    case 'END_LOADING':
      return { ...state, loadingCount: Math.max(0, state.loadingCount - 1) };
    case 'SET_DATA':
      return { ...state, rows: action.rows, columns: action.columns };
    case 'SET_ERROR':
      return { ...state, error: action.error };
  }
}

export function useServiceView(adapter: ServiceAdapter, navKey?: number) {
  const adapterId = adapter.id;
  const adapterSession = useAtomValue(adapterSessionAtom);

  const [state, dispatch] = useReducer(dataReducer, {
    adapterId,
    rows: [],
    columns: [],
    loadingCount: 0,
    error: null,
  });

  // Clear data atomically when adapter session changes (before paint)
  useLayoutEffect(() => {
    if (state.adapterId !== adapterId) {
      debugLog(adapterId, 'useLayoutEffect: adapter changed, clearing data');
      dispatch({ type: 'ADAPTER_CHANGED', adapterId });
    }
  }, [adapterSession, adapterId, state.adapterId]);

  const beginLoading = useCallback(() => {
    debugLog(adapterId, 'beginLoading');
    dispatch({ type: 'BEGIN_LOADING' });
  }, [adapterId]);

  const endLoading = useCallback(() => {
    debugLog(adapterId, 'endLoading');
    dispatch({ type: 'END_LOADING' });
  }, [adapterId]);

  const runWithLoading = useCallback(
    async <T>(fn: () => Promise<T>, clearError = false): Promise<T> => {
      beginLoading();
      if (clearError) dispatch({ type: 'SET_ERROR', error: null });
      try {
        return await fn();
      } finally {
        endLoading();
      }
    },
    [beginLoading, endLoading]
  );

  const refresh = useCallback(async () => {
    debugLog(adapterId, 'refresh() called');
    return runWithLoading(async () => {
      debugLog(adapterId, 'fetching rows...');
      const columns = adapter.getColumns();
      dispatch({ type: 'SET_ERROR', error: null });
      try {
        const r = await adapter.getRows();
        debugLog(adapterId, `got ${r.length} rows from adapter`);
        dispatch({ type: 'SET_DATA', rows: r, columns });
      } catch (e) {
        debugLog(adapterId, 'fetch error', (e as Error).message);
        dispatch({ type: 'SET_ERROR', error: (e as Error).message });
      }
    }, true);
  }, [adapter, runWithLoading, adapterId]);

  useEffect(() => {
    debugLog(adapterId, 'useEffect: adapter changed, fetching data');
    void (async () => {
      dispatch({ type: 'BEGIN_LOADING' });
      dispatch({ type: 'SET_ERROR', error: null });
      debugLog(adapterId, 'fetching rows...');
      const columns = adapter.getColumns();
      try {
        const r = await adapter.getRows();
        debugLog(adapterId, `got ${r.length} rows from adapter`);
        dispatch({ type: 'SET_DATA', rows: r, columns });
      } catch (e) {
        debugLog(adapterId, 'fetch error', (e as Error).message);
        dispatch({ type: 'SET_ERROR', error: (e as Error).message });
      } finally {
        dispatch({ type: 'END_LOADING' });
      }
    })();
  }, [adapter, navKey, adapterId]);

  const processResult = useCallback(
    async (result: SelectResult): Promise<ServiceViewResult> => {
      if (result.action === 'navigate') await refresh();
      if (result.action === 'edit') {
        // Get file modification time before opening
        const before = await stat(result.filePath).catch(() => null);
        const beforeMtime = before?.mtimeMs;

        // Open file in editor
        await openFile(result.filePath);

        // Check if file was modified
        const after = await stat(result.filePath).catch(() => null);
        const afterMtime = after?.mtimeMs;

        if (
          beforeMtime &&
          afterMtime &&
          beforeMtime !== afterMtime &&
          adapter.capabilities?.edit &&
          result.metadata
        ) {
          return { ...result, needsUpload: true };
        }
      }
      return result;
    },
    [adapter, refresh]
  );

  const select = useCallback(
    async (row: TableRow): Promise<ServiceViewResult> => {
      debugLog(adapterId, 'select() called for row', row.id);
      return runWithLoading(async () => {
        const result = await adapter.onSelect(row);
        return processResult(result);
      });
    },
    [adapter, processResult, runWithLoading, adapterId]
  );

  const edit = useCallback(
    async (row: TableRow): Promise<ServiceViewResult> => {
      return runWithLoading(async () => {
        const result = adapter.capabilities?.edit
          ? await adapter.capabilities.edit.onEdit(row)
          : await adapter.onSelect(row);
        return processResult(result);
      });
    },
    [adapter, processResult, runWithLoading]
  );

  const goBack = useCallback(async () => {
    if (!adapter.canGoBack()) return;
    await runWithLoading(async () => {
      adapter.goBack();
      await refresh();
    });
  }, [adapter, refresh, runWithLoading]);

  // Derive effective values: detect if reducer state is stale (adapter changed but ADAPTER_CHANGED not yet processed)
  const isTransitioning = state.adapterId !== adapterId;

  return {
    rows: isTransitioning ? [] : state.rows,
    columns: isTransitioning ? [] : state.columns,
    isLoading: isTransitioning || state.loadingCount > 0,
    error: isTransitioning ? null : state.error,
    select,
    edit,
    goBack,
    refresh,
    path: adapter.getPath(),
  };
}
