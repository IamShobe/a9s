import { useState, useCallback, useEffect } from 'react';
import open from 'open';
import { extname } from 'path';
import { execSync } from 'child_process';
import { stat } from 'fs/promises';
import type { ServiceAdapter } from '../adapters/ServiceAdapter.js';
import type { TableRow, ColumnDef } from '../types.js';

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

export function useServiceView(adapter: ServiceAdapter, navKey?: number) {
  const [rows, setRows] = useState<TableRow[]>([]);
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [loadingCount, setLoadingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const beginLoading = useCallback(() => {
    setLoadingCount((prev) => prev + 1);
  }, []);

  const endLoading = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1));
  }, []);

  const runWithLoading = useCallback(
    async <T>(fn: () => Promise<T>, clearError = false): Promise<T> => {
      beginLoading();
      if (clearError) setError(null);
      try {
        return await fn();
      } finally {
        endLoading();
      }
    },
    [beginLoading, endLoading]
  );

  const refresh = useCallback(async () => {
    return runWithLoading(async () => {
      setColumns(adapter.getColumns());
      try {
        const r = await adapter.getRows();
        setRows(r);
        setColumns(adapter.getColumns());
      } catch (e) {
        setError((e as Error).message);
      }
    }, true);
  }, [adapter, runWithLoading]);

  useEffect(() => {
    void refresh();
  }, [refresh, navKey]);

  const processResult = useCallback(
    async (result: any) => {
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

        if (beforeMtime && afterMtime && beforeMtime !== afterMtime && adapter.uploadFile && result.metadata) {
          // File was modified - would need to show dialog to user
          // For now, we'll return an indicator that upload is needed
          // The App component will handle showing the dialog
          return { ...result, _needsUpload: true };
        }
      }
      return result;
    },
    [adapter, refresh]
  );

  const select = useCallback(
    async (row: TableRow) => {
      return runWithLoading(async () => {
        const result = await adapter.onSelect(row);
        return processResult(result);
      });
    },
    [adapter, processResult, runWithLoading]
  );

  const edit = useCallback(
    async (row: TableRow) => {
      return runWithLoading(async () => {
        const result = adapter.onEdit
          ? await adapter.onEdit(row)
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

  return {
    rows,
    columns,
    isLoading: loadingCount > 0,
    error,
    select,
    edit,
    goBack,
    refresh,
    path: adapter.getPath(),
  };
}
