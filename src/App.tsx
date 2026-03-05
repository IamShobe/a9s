import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { Table } from './components/Table/index.js';
import { HUD } from './components/HUD.js';
import { ModeBar } from './components/ModeBar.js';
import { DetailPanel } from './components/DetailPanel.js';
import { FullscreenBox, useScreenSize } from './utils/withFullscreen.js';
import { useNavigation } from './hooks/useNavigation.js';
import { useServiceView } from './hooks/useServiceView.js';
import { SERVICE_REGISTRY, type ServiceId } from './services.js';
import type { ServiceAdapter, DetailField } from './adapters/ServiceAdapter.js';
import type { AppMode } from './types.js';
import clipboardy from 'clipboardy';

interface AppProps {
  initialService: ServiceId;
  endpointUrl?: string;
}

export function App({ initialService, endpointUrl }: AppProps) {
  const { exit } = useApp();
  const { columns: termCols, rows: termRows } = useScreenSize();

  const [adapter, setAdapter] = useState<ServiceAdapter>(() =>
    SERVICE_REGISTRY[initialService](endpointUrl)
  );
  const [mode, setMode] = useState<AppMode>('navigate');
  const [filterText, setFilterText] = useState('');
  const [commandText, setCommandText] = useState('');
  const [uploadPending, setUploadPending] = useState<{ filePath: string; metadata: Record<string, unknown> } | null>(null);
  const [describeState, setDescribeState] = useState<{
    row: any;
    fields: DetailField[] | null;
    loading: boolean;
  } | null>(null);
  const [yankMode, setYankMode] = useState(false);
  const [yankFeedback, setYankFeedback] = useState<{ message: string; timer: NodeJS.Timeout } | null>(null);
  const filterStackRef = useRef<string[]>([]);
  const modeBarRef = useRef<{ commandInput?: any; filterInput?: any }>(null);

  const HUD_LINES = 1;
  const MODEBAR_LINES = 1;
  const HEADER_LINES = 2; // header + divider
  const tableHeight = Math.max(1, termRows - HUD_LINES - MODEBAR_LINES - HEADER_LINES);

  const { rows, columns, isLoading, error, select, goBack, refresh, path } =
    useServiceView(adapter);

  // Memoize filtered rows to avoid recalculating on every render
  const filteredRows = useMemo(() => {
    if (!filterText) return rows;
    const lowerFilter = filterText.toLowerCase();
    return rows.filter((r) =>
      Object.values(r.cells).some((v) =>
        v.toLowerCase().includes(lowerFilter)
      )
    );
  }, [rows, filterText]);

  const { selectedIndex, scrollOffset, moveUp, moveDown, reset } = useNavigation(
    filteredRows.length,
    tableHeight
  );

  // Cleanup yankFeedback timer
  useEffect(() => {
    return () => {
      if (yankFeedback?.timer) {
        clearTimeout(yankFeedback.timer);
      }
    };
  }, [yankFeedback]);

  // Keep a ref to navigate so we can call reset inside callbacks without stale state issues
  const resetRef = useRef(reset);
  resetRef.current = reset;

  const switchAdapter = useCallback(
    (serviceId: ServiceId) => {
      setAdapter(SERVICE_REGISTRY[serviceId](endpointUrl));
      setFilterText('');
      resetRef.current();
    },
    [endpointUrl]
  );

  const handleCommandSubmit = useCallback(() => {
    const cmd = commandText.trim();
    setCommandText('');
    setMode('navigate');

    if (cmd === 'quit' || cmd === 'q') {
      exit();
      return;
    }

    if (cmd in SERVICE_REGISTRY) {
      switchAdapter(cmd as ServiceId);
    }
  }, [commandText, exit, switchAdapter]);

  const handleFilterSubmit = useCallback(() => {
    setMode('navigate');
  }, []);

  useInput(
    (input, key) => {
      // Handle upload confirmation dialog - block all other input
      if (uploadPending) {
        if (input === 'y' || input === 'Y') {
          void (async () => {
            try {
              await adapter.uploadFile?.(uploadPending.filePath, uploadPending.metadata);
              setUploadPending(null);
            } catch (err) {
              console.error('Upload failed:', (err as Error).message);
              setUploadPending(null);
            }
          })();
        } else if (input === 'n' || input === 'N' || key.escape) {
          setUploadPending(null);
        }
        // Ignore all other keys while dialog is open
        return;
      }

      // Handle detail panel - Esc to close
      if (describeState) {
        if (key.escape) setDescribeState(null);
        return;
      }

      // Handle yank mode (copy shortcuts)
      if (yankMode) {
        setYankMode(false);
        const row = filteredRows[selectedIndex];
        if (!row) return;

        const type = row.meta?.type as string;

        if (input === 'n') {
          // yank name
          const textToCopy = row.cells.name ?? '';
          void (async () => {
            await clipboardy.write(textToCopy);
            const timer = setTimeout(() => setYankFeedback(null), 1500);
            setYankFeedback({ message: 'Copied Name', timer });
          })();
        } else if (input === 'k') {
          // yank key (full path)
          let textToCopy = '';
          if (type === 'bucket') {
            textToCopy = `s3://${row.id}`;
          } else {
            const key = row.meta?.key as string;
            textToCopy = `s3://${adapter.id === 's3' ? (path.split('/')[1] || 'unknown') : 'unknown'}/${key}`;
          }
          void (async () => {
            await clipboardy.write(textToCopy);
            const timer = setTimeout(() => setYankFeedback(null), 1500);
            setYankFeedback({ message: 'Copied Key', timer });
          })();
        } else if (input === 'e') {
          // yank etag (only for objects)
          if (type === 'object') {
            void (async () => {
              const fields = await adapter.getDetails?.(row) ?? [];
              const etag = fields.find((f) => f.label === 'ETag')?.value ?? '';
              if (etag && etag !== '-') {
                await clipboardy.write(etag);
                const timer = setTimeout(() => setYankFeedback(null), 1500);
                setYankFeedback({ message: 'Copied ETag', timer });
              }
            })();
          }
        } else if (input === 'd') {
          // yank last modified date
          if (type === 'object') {
            void (async () => {
              const fields = await adapter.getDetails?.(row) ?? [];
              const lastMod = fields.find((f) => f.label === 'Last Modified')?.value ?? '';
              if (lastMod && lastMod !== '-') {
                await clipboardy.write(lastMod);
                const timer = setTimeout(() => setYankFeedback(null), 1500);
                setYankFeedback({ message: 'Copied Last Modified', timer });
              }
            })();
          }
        }
        return;
      }

      if (key.escape) {
        if (mode === 'search' || mode === 'command') {
          setMode('navigate');
        } else {
          // In navigate mode, Escape goes back
          void goBack().then(() => {
            // Restore filter from stack if available
            const previousFilter = filterStackRef.current.pop() ?? '';
            setFilterText(previousFilter);
            resetRef.current();
          });
        }
        return;
      }

      // Tab autocompletes in command or search mode
      if (key.tab) {
        if (mode === 'command') {
          modeBarRef.current?.commandInput?.autocomplete();
        } else if (mode === 'search') {
          modeBarRef.current?.filterInput?.autocomplete();
        }
        return;
      }

      if (mode === 'search') return;
      if (mode === 'command') return;

      if (input === '/') {
        setFilterText('');
        setMode('search');
        return;
      }

      if (input === ':') {
        setCommandText('');
        setMode('command');
        return;
      }

      if (input === 'q') {
        exit();
        return;
      }

      if (input === 'r') {
        void refresh();
        return;
      }

      if (input === 'y') {
        setYankMode(true);
        return;
      }

      if (input === 'd') {
        const row = filteredRows[selectedIndex];
        if (!row) return;
        setDescribeState({ row, fields: null, loading: true });
        void (async () => {
          const fields = await adapter.getDetails?.(row) ?? [];
          setDescribeState((prev) => prev ? { ...prev, fields, loading: false } : null);
        })();
        return;
      }

      if (key.downArrow || input === 'j') {
        moveDown();
        return;
      }

      if (key.upArrow || input === 'k') {
        moveUp();
        return;
      }


      if (input === 'e') {
        // Edit file
        const row = filteredRows[selectedIndex];
        if (row) {
          const type = row.meta?.type as string;
          if (type === 'object') {
            void select(row).then((result: any) => {
              // Check if file needs upload confirmation
              if (result?._needsUpload && result?.metadata) {
                setUploadPending({
                  filePath: result.filePath,
                  metadata: result.metadata,
                });
              }
            });
          }
        }
        return;
      }

      if (key.return) {
        // Navigate into folders/buckets
        const row = filteredRows[selectedIndex];
        if (row) {
          const type = row.meta?.type as string;
          if (type !== 'object') {
            void select(row).then((result: any) => {
              if (result?.action === 'navigate') {
                // Save current filter before clearing for new scope
                filterStackRef.current.push(filterText);
                setFilterText('');
                resetRef.current();
              }
            });
          }
        }
        return;
      }

      if (key.backspace || key.delete) {
        void goBack().then(() => {
          // Restore filter from stack if available
          const previousFilter = filterStackRef.current.pop() ?? '';
          setFilterText(previousFilter);
          resetRef.current();
        });
        return;
      }
    },
    { isActive: true }
  );

  const itemsShown = filterText ? filteredRows.length : rows.length;
  const itemsTotal = rows.length;

  return (
    <FullscreenBox flexDirection="column">
      <HUD
        serviceLabel={adapter.label}
        hudColor={adapter.hudColor}
        path={path}
        terminalWidth={termCols}
      />
      {uploadPending && (
        <Box paddingX={1} paddingY={1} backgroundColor="blue">
          <Text color="white" bold>
            File was modified. Upload to S3? (y/n)
          </Text>
        </Box>
      )}
      {yankMode && (
        <Box paddingX={1} paddingY={1} backgroundColor="cyan">
          <Text color="black" bold>
            Yank: n(ame)  k(ey)  e(tag)  d(ate)
          </Text>
        </Box>
      )}
      {yankFeedback && (
        <Box paddingX={1} paddingY={1} backgroundColor="green">
          <Text color="black" bold>
            {yankFeedback.message}
          </Text>
        </Box>
      )}
      <Box flexGrow={1} flexDirection="column">
        {isLoading && <Text color="gray">Loading...</Text>}
        {error && <Text color="red">Error: {error}</Text>}
        {!uploadPending && !isLoading && !error && describeState && (
          <DetailPanel
            title={describeState.row.cells.name ?? describeState.row.id}
            fields={describeState.fields ?? []}
            isLoading={describeState.loading}
          />
        )}
        {!uploadPending && !isLoading && !error && !describeState && (
          <Table
            columns={columns}
            rows={filteredRows}
            selectedIndex={selectedIndex}
            filterText={filterText}
            terminalWidth={termCols}
            maxHeight={tableHeight}
            scrollOffset={scrollOffset}
            contextLabel={adapter.getContextLabel?.()}
          />
        )}
      </Box>
      <Box paddingX={1} paddingTop={1}>
        <Text color="gray">
          {itemsShown === itemsTotal
            ? `${itemsTotal} items`
            : `${itemsShown} / ${itemsTotal} items`}
        </Text>
        {filterText && (
          <>
            <Text color="gray">  •  </Text>
            <Text color="gray">
              filter: "{filterText}"
            </Text>
          </>
        )}
      </Box>
      <ModeBar
        ref={modeBarRef}
        mode={mode}
        filterText={filterText}
        commandText={commandText}
        onFilterChange={setFilterText}
        onCommandChange={setCommandText}
        onFilterSubmit={handleFilterSubmit}
        onCommandSubmit={handleCommandSubmit}
      />
    </FullscreenBox>
  );
}
