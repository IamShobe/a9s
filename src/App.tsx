import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { atom, getDefaultStore, useAtom } from "jotai";
import clipboardy from "clipboardy";
import TextInput from "ink-text-input";
import { isAbsolute, resolve } from "path";

import { Table } from "./components/Table/index.js";
import { HUD } from "./components/HUD.js";
import { ModeBar } from "./components/ModeBar.js";
import { DetailPanel } from "./components/DetailPanel.js";
import { ErrorStatePanel } from "./components/ErrorStatePanel.js";
import {
  HelpPanel,
  type HelpItem,
  type HelpTab,
} from "./components/HelpPanel.js";
import { FullscreenBox, useScreenSize } from "./utils/withFullscreen.js";
import { useNavigation } from "./hooks/useNavigation.js";
import { useServiceView } from "./hooks/useServiceView.js";
import { useAwsContext } from "./hooks/useAwsContext.js";
import { useAwsRegions } from "./hooks/useAwsRegions.js";
import { useAwsProfiles } from "./hooks/useAwsProfiles.js";
import { SERVICE_REGISTRY } from "./services.js";
import type { ServiceId } from "./services.js";
import { s3LevelAtom, s3BackStackAtom } from "./views/s3/adapter.js";
import type { AppMode, TableRow } from "./types.js";
import type { DetailField, ServiceAdapter } from "./adapters/ServiceAdapter.js";

const currentlySelectedServiceAtom = atom<ServiceId>("s3");
const modeAtom = atom<AppMode>("navigate");
const filterTextAtom = atom("");
const commandTextAtom = atom("");
const uploadPendingAtom = atom<{
  filePath: string;
  metadata: Record<string, unknown>;
} | null>(null);
const describeStateAtom = atom<{
  row: TableRow;
  fields: DetailField[] | null;
  loading: boolean;
  requestId: number;
} | null>(null);
const yankModeAtom = atom(false);
const yankFeedbackAtom = atom<{
  message: string;
  timer: NodeJS.Timeout;
} | null>(null);
const helpOpenAtom = atom(false);
const helpTabIndexAtom = atom(0);
const helpScrollOffsetAtom = atom(0);
const filterStackAtom = atom<string[]>([""]);
const selectedIndexStackAtom = atom<number[]>([0]);
const searchEntryFilterAtom = atom<string | null>(null);
const selectedRegionAtom = atom(
  process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1",
);
const selectedProfileAtom = atom(process.env.AWS_PROFILE ?? "$default");
const regionPickerOpenAtom = atom(false);
const regionPickerFilterAtom = atom("");
const regionPickerSearchEntryAtom = atom<string | null>(null);
const profilePickerOpenAtom = atom(false);
const profilePickerFilterAtom = atom("");
const profilePickerSearchEntryAtom = atom<string | null>(null);
const resourcePickerOpenAtom = atom(false);
const resourcePickerFilterAtom = atom("");
const resourcePickerSearchEntryAtom = atom<string | null>(null);
const fetchPromptAtom = atom<{ row: TableRow; destinationPath: string } | null>(
  null,
);
const fetchOverwritePendingAtom = atom<{
  row: TableRow;
  destinationPath: string;
  finalPath: string;
} | null>(null);
const jumpPromptAtom = atom<string | null>(null);
let detailRequestSeq = 0;
const INITIAL_AWS_PROFILE = process.env.AWS_PROFILE;
const COMMAND_SUGGESTIONS = [
  "s3",
  "route53",
  "dynamodb",
  "iam",
  "regions",
  "profiles",
  "resources",
  "region",
  "profile",
  "use-region",
  "use-profile",
  "$default",
  "quit",
];

function nextDetailRequestId(): number {
  detailRequestSeq += 1;
  return detailRequestSeq;
}

interface AppProps {
  initialService: ServiceId;
  endpointUrl: string | undefined;
}

export function App({ initialService, endpointUrl }: AppProps) {
  const { exit } = useApp();
  const { columns: termCols, rows: termRows } = useScreenSize();
  const [selectedRegion, setSelectedRegion] = useAtom(selectedRegionAtom);
  const [selectedProfile, setSelectedProfile] = useAtom(selectedProfileAtom);
  const availableRegions = useAwsRegions(selectedRegion, selectedProfile);
  const availableProfiles = useAwsProfiles();
  const { accountName, accountId, awsProfile, currentIdentity, region } =
    useAwsContext(endpointUrl, selectedRegion, selectedProfile);

  const [currentService, setCurrentService] = useAtom(
    currentlySelectedServiceAtom,
  );
  const [mode, setMode] = useAtom(modeAtom);
  const [filterText, setFilterText] = useAtom(filterTextAtom);
  const [commandText, setCommandText] = useAtom(commandTextAtom);
  const [uploadPending, setUploadPending] = useAtom(uploadPendingAtom);
  const [describeState, setDescribeState] = useAtom(describeStateAtom);
  const [yankMode, setYankMode] = useAtom(yankModeAtom);
  const [yankFeedback, setYankFeedback] = useAtom(yankFeedbackAtom);
  const [helpOpen, setHelpOpen] = useAtom(helpOpenAtom);
  const [helpTabIndex, setHelpTabIndex] = useAtom(helpTabIndexAtom);
  const [helpScrollOffset, setHelpScrollOffset] = useAtom(helpScrollOffsetAtom);
  const [filterStack, setFilterStack] = useAtom(filterStackAtom);
  const [selectedIndexStack, setSelectedIndexStack] = useAtom(
    selectedIndexStackAtom,
  );
  const [searchEntryFilter, setSearchEntryFilter] = useAtom(
    searchEntryFilterAtom,
  );
  const [regionPickerOpen, setRegionPickerOpen] = useAtom(regionPickerOpenAtom);
  const [regionPickerFilter, setRegionPickerFilter] = useAtom(
    regionPickerFilterAtom,
  );
  const [regionPickerSearchEntry, setRegionPickerSearchEntry] = useAtom(
    regionPickerSearchEntryAtom,
  );
  const [profilePickerOpen, setProfilePickerOpen] = useAtom(
    profilePickerOpenAtom,
  );
  const [profilePickerFilter, setProfilePickerFilter] = useAtom(
    profilePickerFilterAtom,
  );
  const [profilePickerSearchEntry, setProfilePickerSearchEntry] = useAtom(
    profilePickerSearchEntryAtom,
  );
  const [resourcePickerOpen, setResourcePickerOpen] = useAtom(
    resourcePickerOpenAtom,
  );
  const [resourcePickerFilter, setResourcePickerFilter] = useAtom(
    resourcePickerFilterAtom,
  );
  const [resourcePickerSearchEntry, setResourcePickerSearchEntry] = useAtom(
    resourcePickerSearchEntryAtom,
  );
  const [fetchPrompt, setFetchPrompt] = useAtom(fetchPromptAtom);
  const [fetchOverwritePending, setFetchOverwritePending] = useAtom(
    fetchOverwritePendingAtom,
  );
  const [jumpPrompt, setJumpPrompt] = useAtom(jumpPromptAtom);
  const [gPrefixPending, setGPrefixPending] = useState(false);
  const [commandCursorToEndToken, setCommandCursorToEndToken] = useState(0);

  const adapter = useMemo<ServiceAdapter>(() => {
    if (currentService === "s3") {
      const store = getDefaultStore();
      return SERVICE_REGISTRY.s3(
        endpointUrl,
        selectedRegion,
        () => store.get(s3LevelAtom),
        (level) => store.set(s3LevelAtom, level),
        () => store.get(s3BackStackAtom),
        (stack) => store.set(s3BackStackAtom, stack),
      );
    }

    return SERVICE_REGISTRY[currentService](endpointUrl, selectedRegion);
  }, [currentService, endpointUrl, selectedRegion, selectedProfile]);

  useEffect(() => {
    if (selectedProfile === "$default") {
      if (INITIAL_AWS_PROFILE === undefined) {
        delete process.env.AWS_PROFILE;
      } else {
        process.env.AWS_PROFILE = INITIAL_AWS_PROFILE;
      }
      return;
    }
    process.env.AWS_PROFILE = selectedProfile;
  }, [selectedProfile]);

  useEffect(() => {
    setCurrentService(initialService);
  }, [initialService, setCurrentService]);

  const HUD_LINES = 3;
  const MODEBAR_LINES = 1;
  const HEADER_LINES = 2;
  const tableHeight = Math.max(
    1,
    termRows - HUD_LINES - MODEBAR_LINES - HEADER_LINES - 4,
  );

  const { rows, columns, isLoading, error, select, edit, goBack, refresh, path } =
    useServiceView(adapter);

  const filteredRows = useMemo(() => {
    if (!filterText) return rows;
    const lowerFilter = filterText.toLowerCase();
    return rows.filter((row) =>
      Object.values(row.cells).some((value) =>
        value.toLowerCase().includes(lowerFilter),
      ),
    );
  }, [rows, filterText]);

  const {
    selectedIndex,
    scrollOffset,
    moveUp,
    moveDown,
    reset,
    setIndex,
    toTop,
    toBottom,
  } = useNavigation(filteredRows.length, tableHeight);
  const regionRows = useMemo(
    () =>
      availableRegions.map((regionItem) => ({
        id: regionItem.name,
        cells: { region: regionItem.name, description: regionItem.description },
        meta: {},
      })),
    [availableRegions],
  );
  const filteredRegionRows = useMemo(() => {
    if (!regionPickerFilter) return regionRows;
    const f = regionPickerFilter.toLowerCase();
    return regionRows.filter((row) =>
      row.cells.region.toLowerCase().includes(f),
    );
  }, [regionPickerFilter, regionRows]);
  const {
    selectedIndex: regionSelectedIndex,
    scrollOffset: regionScrollOffset,
    moveUp: moveRegionUp,
    moveDown: moveRegionDown,
    reset: resetRegionNav,
    toTop: toRegionTop,
    toBottom: toRegionBottom,
  } = useNavigation(filteredRegionRows.length, tableHeight);
  const profileRows = useMemo(
    () =>
      availableProfiles.map((profileItem) => ({
        id: profileItem.name,
        cells: {
          profile: profileItem.name,
          description: profileItem.description,
        },
        meta: {},
      })),
    [availableProfiles],
  );
  const filteredProfileRows = useMemo(() => {
    if (!profilePickerFilter) return profileRows;
    const f = profilePickerFilter.toLowerCase();
    return profileRows.filter((row) =>
      row.cells.profile.toLowerCase().includes(f),
    );
  }, [profilePickerFilter, profileRows]);
  const {
    selectedIndex: profileSelectedIndex,
    scrollOffset: profileScrollOffset,
    moveUp: moveProfileUp,
    moveDown: moveProfileDown,
    reset: resetProfileNav,
    toTop: toProfileTop,
    toBottom: toProfileBottom,
  } = useNavigation(filteredProfileRows.length, tableHeight);
  const resourceRows = useMemo(
    () =>
      (Object.keys(SERVICE_REGISTRY) as ServiceId[]).map((serviceId) => ({
        id: serviceId,
        cells: {
          resource: serviceId,
          description: `${serviceId.toUpperCase()} service`,
        },
        meta: {},
      })),
    [],
  );
  const filteredResourceRows = useMemo(() => {
    if (!resourcePickerFilter) return resourceRows;
    const f = resourcePickerFilter.toLowerCase();
    return resourceRows.filter((row) =>
      Object.values(row.cells).some((v) => v.toLowerCase().includes(f)),
    );
  }, [resourcePickerFilter, resourceRows]);
  const {
    selectedIndex: resourceSelectedIndex,
    scrollOffset: resourceScrollOffset,
    moveUp: moveResourceUp,
    moveDown: moveResourceDown,
    reset: resetResourceNav,
    toTop: toResourceTop,
    toBottom: toResourceBottom,
  } = useNavigation(filteredResourceRows.length, tableHeight);

  const selectedRow = filteredRows[selectedIndex] ?? null;
  const selectedRegionRow = filteredRegionRows[regionSelectedIndex] ?? null;
  const selectedProfileRow = filteredProfileRows[profileSelectedIndex] ?? null;
  const selectedResourceRow = filteredResourceRows[resourceSelectedIndex] ?? null;
  const yankOptions = useMemo(() => {
    if (!selectedRow) return [{ key: "Esc", label: "cancel" }];

    const type = selectedRow.meta?.type as string | undefined;
    const options: Array<{ key: string; label: string }> = [
      { key: "n", label: "copy name" },
    ];

    if (adapter.id === "s3") {
      if (type === "bucket" || type === "folder" || type === "object") {
        options.push({ key: "k", label: "copy key/path" });
      }
      if (type === "bucket" || type === "folder" || type === "object") {
        options.push({ key: "a", label: "copy arn" });
      }
      if (type === "object") {
        options.push({ key: "e", label: "copy etag" });
        options.push({ key: "d", label: "copy last-modified" });
      }
    }
    if (adapter.id === "iam") {
      const arn = selectedRow.meta?.arn ?? selectedRow.meta?.policyArn;
      if (typeof arn === "string" && arn.length > 0) {
        options.push({ key: "a", label: "copy arn" });
      }
    }

    options.push({ key: "Esc", label: "cancel" });
    return options;
  }, [adapter.id, selectedRow]);
  const yankHint = useMemo(
    () => yankOptions.map((item) => `${item.key} ${item.label}`).join("  •  "),
    [yankOptions],
  );
  const uiScope = helpOpen
    ? "help"
    : regionPickerOpen
      ? "regions"
      : profilePickerOpen
        ? "profiles"
        : resourcePickerOpen
          ? "resources"
        : jumpPrompt !== null
          ? "jump"
          : fetchOverwritePending
            ? "fetch-overwrite"
            : fetchPrompt
              ? "fetch"
              : uploadPending
                ? "upload"
                : describeState
                  ? "details"
                  : yankMode
                    ? "yank"
                    : mode;

  const helpTabs = useMemo<HelpTab[]>(() => {
    const navigateItems: HelpItem[] = [
      { key: "j / ↓", description: "Move selection down" },
      { key: "k / ↑", description: "Move selection up" },
      { key: "g p", description: "Go path jump prompt (S3 only)" },
      { key: "g g / G", description: "Top / bottom" },
      { key: "Enter", description: "Open bucket/folder (navigate only)" },
      { key: "e", description: "Edit selected item" },
      { key: "Esc", description: "Clear filter, then go back level" },
      { key: "d", description: "Open details panel" },
      { key: "y", description: "Open yank mode" },
      { key: "/", description: "Search mode" },
      { key: ":", description: "Command mode" },
      { key: "r / q", description: "Refresh / quit" },
      { key: "?", description: "Open this help (navigate mode only)" },
    ];

    if (adapter.id === "s3") {
      navigateItems.splice(3, 0, {
        key: "y then k",
        description: "Copy selected S3 URI",
      });
    }

    return [
      {
        title: "Navigate",
        items: navigateItems,
      },
      {
        title: "Search",
        items: [
          { key: "Open", description: "Press / in navigate mode" },
          { key: "Type", description: "Update filter text" },
          { key: "Tab", description: "Autocomplete input" },
          { key: "Enter", description: "Apply filter and return to navigate" },
          { key: "Esc", description: "Cancel and restore previous filter" },
        ],
      },
      {
        title: "Command",
        items: [
          { key: "Open", description: "Press : in navigate mode" },
          {
            key: "Type",
            description: "Enter command (s3/route53/dynamodb/iam/quit)",
          },
          { key: "Tab", description: "Autocomplete command" },
          { key: "Enter", description: "Run command" },
          { key: "Esc", description: "Cancel command mode" },
        ],
      },
      {
        title: "Yank",
        items: [
          { key: "Open", description: "Press y in navigate mode" },
          { key: "n", description: "Copy selected name" },
          { key: "a", description: "Copy ARN (when available)" },
          { key: "k", description: "Copy selected S3/object key path" },
          { key: "e", description: "Copy ETag (objects only)" },
          { key: "d", description: "Copy Last Modified (objects only)" },
          { key: "Esc", description: "Cancel yank mode" },
        ],
      },
      {
        title: "Details",
        items: [
          { key: "Open", description: "Press d in navigate mode" },
          { key: "Esc", description: "Close details panel" },
        ],
      },
      {
        title: "Upload",
        items: [
          { key: "When", description: "After editing if file changed" },
          { key: "y", description: "Upload edited file" },
          { key: "n / Esc", description: "Cancel upload" },
        ],
      },
    ];
  }, [adapter.id]);

  const helpTabsCount = helpTabs.length;
  const helpContainerHeight = Math.max(1, termRows - HUD_LINES - MODEBAR_LINES);
  // Fixed rows in HelpPanel: title + scope + tab row.
  const baseHelpVisibleRows = Math.max(1, helpContainerHeight - 3);
  const activeHelpItemsCount = helpTabs[helpTabIndex]?.items.length ?? 0;
  const overflowRows = Math.max(0, activeHelpItemsCount - baseHelpVisibleRows);
  const scrollReserveRows = Math.min(3, overflowRows);
  const helpVisibleRows =
    overflowRows > 0
      ? Math.max(1, baseHelpVisibleRows - scrollReserveRows - 1)
      : Math.max(1, baseHelpVisibleRows - 1);

  const clampHelpTab = useCallback(
    (idx: number) => ((idx % helpTabsCount) + helpTabsCount) % helpTabsCount,
    [helpTabsCount],
  );

  const getHelpTabFromInput = useCallback(
    (input: string): number | null => {
      if (input.length !== 1) return null;
      const num = Number.parseInt(input, 10);
      if (Number.isNaN(num) || num < 1 || num > helpTabsCount) return null;
      return num - 1;
    },
    [helpTabsCount],
  );

  const helpScopeLabel = "All modes reference";

  const bottomHint = useMemo(() => {
    switch (uiScope) {
      case "help":
        return " ←/→ or h/l switch tabs  •  ↑/↓ or j/k scroll  •  Esc/? close";
      case "regions":
        return " j/k ↑↓ move  •  / filter  •  Enter select region  •  Esc close";
      case "profiles":
        return " j/k ↑↓ move  •  / filter  •  Enter select profile  •  Esc close";
      case "resources":
        return " j/k ↑↓ move  •  / filter  •  Enter select resource  •  Esc close";
      case "jump":
        return " Enter jump  •  Esc cancel";
      case "fetch":
        return " Enter download to path  •  Esc cancel";
      case "fetch-overwrite":
        return " y overwrite file  •  n/Esc cancel";
      case "upload":
        return " y upload edited file  •  n/Esc cancel";
      case "details":
        return " Esc close details";
      case "yank":
        return ` ${yankHint}`;
      case "search":
        return " Type filter  •  Tab autocomplete  •  Enter apply  •  Esc cancel";
      case "command":
        return " Commands: s3 route53 dynamodb iam quit regions profiles resources  •  Enter run  •  Esc cancel";
      default:
        return " j/k ↑/↓ move  •  gp go-path  •  gg/G top/bottom  •  Enter navigate  •  e edit  •  f fetch  •  / search";
    }
  }, [uiScope, yankHint]);

  const helpItems = useMemo<HelpItem[]>(() => {
    return [
      { key: "Type", description: "Update filter text" },
      { key: "?", description: "Open help from navigate mode" },
    ];
  }, []);

  useEffect(() => {
    return () => {
      if (yankFeedback?.timer) clearTimeout(yankFeedback.timer);
    };
  }, [yankFeedback]);

  const switchAdapter = useCallback(
    (serviceId: ServiceId) => {
      setCurrentService(serviceId);
      setFilterText("");
      setDescribeState(null);
      setSearchEntryFilter(null);
      setFilterStack([""]);
      setSelectedIndexStack([0]);
      reset();
    },
    [
      reset,
      setCurrentService,
      setDescribeState,
      setFilterStack,
      setFilterText,
      setSearchEntryFilter,
      setSelectedIndexStack,
    ],
  );

  const handleCommandSubmit = useCallback(() => {
    const command = commandText.trim();
    setCommandText("");
    setMode("navigate");
    if (command === "profiles") {
      setProfilePickerFilter("");
      setProfilePickerSearchEntry(null);
      resetProfileNav();
      setProfilePickerOpen(true);
      return;
    }
    if (command === "regions") {
      setRegionPickerFilter("");
      setRegionPickerSearchEntry(null);
      resetRegionNav();
      setRegionPickerOpen(true);
      return;
    }
    if (command === "resources") {
      setResourcePickerFilter("");
      setResourcePickerSearchEntry(null);
      resetResourceNav();
      setResourcePickerOpen(true);
      return;
    }
    const regionMatch = command.match(/^(region|use-region)\s+([a-z0-9-]+)$/i);
    if (regionMatch) {
      const nextRegion = regionMatch[2]?.toLowerCase();
      if (nextRegion) setSelectedRegion(nextRegion);
      return;
    }
    const profileMatch = command.match(/^(profile|use-profile)\s+(.+)$/i);
    if (profileMatch) {
      const nextProfile = profileMatch[2]?.trim();
      if (nextProfile) setSelectedProfile(nextProfile);
      return;
    }

    if (command === "quit" || command === "q") {
      exit();
      return;
    }

    if (command in SERVICE_REGISTRY) {
      switchAdapter(command as ServiceId);
    }
  }, [
    commandText,
    exit,
    resetProfileNav,
    resetRegionNav,
    resetResourceNav,
    setCommandText,
    setMode,
    setProfilePickerFilter,
    setProfilePickerOpen,
    setProfilePickerSearchEntry,
    setRegionPickerFilter,
    setRegionPickerOpen,
    setRegionPickerSearchEntry,
    setResourcePickerFilter,
    setResourcePickerOpen,
    setResourcePickerSearchEntry,
    setSelectedProfile,
    setSelectedRegion,
    switchAdapter,
  ]);

  const handleFilterSubmit = useCallback(() => {
    if (regionPickerOpen) {
      setRegionPickerSearchEntry(null);
      setMode("navigate");
      return;
    }
    if (profilePickerOpen) {
      setProfilePickerSearchEntry(null);
      setMode("navigate");
      return;
    }
    if (resourcePickerOpen) {
      setResourcePickerSearchEntry(null);
      setMode("navigate");
      return;
    }
    setSearchEntryFilter(null);
    setMode("navigate");
  }, [
    profilePickerOpen,
    regionPickerOpen,
    resourcePickerOpen,
    setMode,
    setProfilePickerSearchEntry,
    setRegionPickerSearchEntry,
    setResourcePickerSearchEntry,
    setSearchEntryFilter,
  ]);

  const handleFilterChange = useCallback(
    (value: string) => {
      if (regionPickerOpen) {
        setRegionPickerFilter(value);
        return;
      }
      if (profilePickerOpen) {
        setProfilePickerFilter(value);
        return;
      }
      if (resourcePickerOpen) {
        setResourcePickerFilter(value);
        return;
      }
      setFilterText(value);
      setFilterStack((prev) => {
        if (prev.length === 0) return [value];
        const next = [...prev];
        next[next.length - 1] = value;
        return next;
      });
    },
    [
      profilePickerOpen,
      regionPickerOpen,
      resourcePickerOpen,
      setFilterStack,
      setFilterText,
      setProfilePickerFilter,
      setRegionPickerFilter,
      setResourcePickerFilter,
    ],
  );

  const navigateBack = useCallback(() => {
    if (!adapter.canGoBack()) return;

    void goBack().then(() => {
      setDescribeState(null);
      setSearchEntryFilter(null);
      const nextStack =
        filterStack.length > 1 ? filterStack.slice(0, -1) : filterStack;
      setFilterStack(nextStack);
      const nextIndexStack =
        selectedIndexStack.length > 1
          ? selectedIndexStack.slice(0, -1)
          : selectedIndexStack;
      setSelectedIndexStack(nextIndexStack);
      const poppedIndex =
        selectedIndexStack.length > 1
          ? (selectedIndexStack[selectedIndexStack.length - 1] ?? 0)
          : (selectedIndexStack[0] ?? 0);
      const previousFilter = nextStack[nextStack.length - 1] ?? "";
      setFilterText(previousFilter);
      setIndex(poppedIndex);
    });
  }, [
    adapter,
    filterStack,
    goBack,
    selectedIndexStack,
    setDescribeState,
    setFilterStack,
    setFilterText,
    setSearchEntryFilter,
    setSelectedIndexStack,
    setIndex,
  ]);

  const navigateIntoSelection = useCallback(() => {
    if (!selectedRow) return;
    if ((selectedRow.meta?.type as string) === "object") return;

    void select(selectedRow).then((result: any) => {
      if (result?.action === "navigate") {
        setSearchEntryFilter(null);
        setFilterStack((prev) => [...prev, ""]);
        setSelectedIndexStack((prev) => [...prev, selectedIndex]);
        setFilterText("");
        setDescribeState(null);
        reset();
        return;
      }

      if (result?._needsUpload && result.metadata) {
        setUploadPending({
          filePath: result.filePath,
          metadata: result.metadata,
        });
      }
    });
  }, [
    reset,
    select,
    selectedRow,
    setDescribeState,
    setFilterStack,
    setSelectedIndexStack,
    setFilterText,
    setSearchEntryFilter,
    setUploadPending,
    selectedIndex,
  ]);

  const editSelection = useCallback(() => {
    if (!selectedRow) return;

    void edit(selectedRow).then((result: any) => {
      if (result?._needsUpload && result.metadata) {
        setUploadPending({
          filePath: result.filePath,
          metadata: result.metadata,
        });
      }
    });
  }, [edit, selectedRow, setUploadPending]);

  const showDetails = useCallback(() => {
    if (!selectedRow) return;
    const requestId = nextDetailRequestId();
    setDescribeState({
      row: selectedRow,
      fields: null,
      loading: true,
      requestId,
    });

    void (async () => {
      try {
        const fields = adapter.getDetails
          ? await adapter.getDetails(selectedRow)
          : [
              {
                label: "Name",
                value: selectedRow.cells.name ?? selectedRow.id,
              },
              {
                label: "Type",
                value: String(selectedRow.meta?.type ?? "Unknown"),
              },
              { label: "Details", value: "Not available for this service" },
            ];

        setDescribeState((prev) =>
          prev && prev.requestId === requestId
            ? { ...prev, fields, loading: false, requestId }
            : prev,
        );
      } catch (error) {
        setDescribeState((prev) =>
          prev && prev.requestId === requestId
            ? {
                ...prev,
                fields: [
                  {
                    label: "Name",
                    value: selectedRow.cells.name ?? selectedRow.id,
                  },
                  { label: "Error", value: (error as Error).message },
                ],
                loading: false,
                requestId,
              }
            : prev,
        );
      }
    })();
  }, [adapter, selectedRow, setDescribeState]);

  const pushYankFeedback = useCallback(
    (message: string) => {
      const timer = setTimeout(() => setYankFeedback(null), 1500);
      setYankFeedback({ message, timer });
    },
    [setYankFeedback],
  );

  const openFetchPrompt = useCallback(() => {
    if (!selectedRow || (selectedRow.meta?.type as string) !== "object") return;
    const configured = process.env.DOWNLOAD_LOCATION;
    const cwd = process.cwd();
    const defaultPath = configured
      ? isAbsolute(configured)
        ? configured
        : resolve(cwd, configured)
      : cwd;
    setFetchPrompt({ row: selectedRow, destinationPath: defaultPath });
  }, [selectedRow, setFetchPrompt]);

  const submitFetchPrompt = useCallback(() => {
    if (!fetchPrompt) return;
    const target = fetchPrompt.destinationPath.trim();
    if (!target) return;
    if (!adapter.fetchTo) return;
    void adapter
      .fetchTo(fetchPrompt.row, target, false)
      .then((savedTo) => {
        const timer = setTimeout(() => setYankFeedback(null), 2500);
        setYankFeedback({ message: `Downloaded to ${savedTo}`, timer });
      })
      .catch((err) => {
        const message = (err as Error).message;
        if (message.startsWith("EEXIST_FILE:")) {
          const finalPath = message.slice("EEXIST_FILE:".length);
          setFetchOverwritePending({
            row: fetchPrompt.row,
            destinationPath: target,
            finalPath,
          });
          setFetchPrompt(null);
          return;
        }
        const timer = setTimeout(() => setYankFeedback(null), 3000);
        setYankFeedback({ message: `Fetch failed: ${message}`, timer });
      })
      .finally(() => {
        setFetchPrompt((prev) =>
          prev && prev.row.id === fetchPrompt.row.id ? null : prev,
        );
      });
  }, [
    adapter,
    fetchPrompt,
    setFetchOverwritePending,
    setFetchPrompt,
    setYankFeedback,
  ]);

  const submitJumpPrompt = useCallback(() => {
    if (jumpPrompt === null) return;
    const target = jumpPrompt.trim();
    if (!target) return;
    if (!adapter.jumpTo) return;

    void adapter
      .jumpTo(target)
      .then(async () => {
        setJumpPrompt(null);
        setMode("navigate");
        setFilterText("");
        setSearchEntryFilter(null);
        setFilterStack((prev) => [...prev, ""]);
        setSelectedIndexStack((prev) => [...prev, selectedIndex]);
        reset();
        await refresh();
      })
      .catch((err) => {
        const timer = setTimeout(() => setYankFeedback(null), 3000);
        setYankFeedback({
          message: `Jump failed: ${(err as Error).message}`,
          timer,
        });
      });
  }, [
    adapter,
    jumpPrompt,
    refresh,
    reset,
    setFilterStack,
    setSelectedIndexStack,
    setFilterText,
    setJumpPrompt,
    setMode,
    setSearchEntryFilter,
    setYankFeedback,
    selectedIndex,
  ]);

  useInput(
    (input, key) => {
      if (helpOpen) {
        if (gPrefixPending) setGPrefixPending(false);
        if (key.escape || input === "?") {
          setHelpOpen(false);
          return;
        }
        if (key.leftArrow || input === "h") {
          setHelpScrollOffset(0);
          setHelpTabIndex((prev) => clampHelpTab(prev - 1));
          return;
        }
        if (key.rightArrow || input === "l") {
          setHelpScrollOffset(0);
          setHelpTabIndex((prev) => clampHelpTab(prev + 1));
          return;
        }
        if (key.upArrow || input === "k") {
          setHelpScrollOffset((prev) => Math.max(0, prev - 1));
          return;
        }
        if (key.downArrow || input === "j") {
          const maxOffset = Math.max(
            0,
            (helpTabs[helpTabIndex]?.items.length ?? 0) - helpVisibleRows,
          );
          setHelpScrollOffset((prev) => Math.min(maxOffset, prev + 1));
          return;
        }
        const numericTab = getHelpTabFromInput(input);
        if (numericTab !== null) {
          setHelpScrollOffset(0);
          setHelpTabIndex(numericTab);
        }
        return;
      }

      if (resourcePickerOpen) {
        if (input === "G") {
          setGPrefixPending(false);
          toResourceBottom();
          return;
        }
        if (input === "g") {
          if (gPrefixPending) {
            setGPrefixPending(false);
            toResourceTop();
          } else {
            setGPrefixPending(true);
          }
          return;
        }
        if (gPrefixPending) setGPrefixPending(false);
        if (key.escape) {
          if (mode === "search") {
            if (
              resourcePickerSearchEntry !== null &&
              resourcePickerFilter !== ""
            ) {
              setResourcePickerFilter(resourcePickerSearchEntry);
            }
            setResourcePickerSearchEntry(null);
            setMode("navigate");
          } else {
            setResourcePickerOpen(false);
            setResourcePickerFilter("");
            setResourcePickerSearchEntry(null);
            setMode("navigate");
          }
          return;
        }
        if (mode === "search") return;
        if (input === "/") {
          setResourcePickerSearchEntry(resourcePickerFilter);
          setMode("search");
          return;
        }
        if (key.downArrow || input === "j") {
          moveResourceDown();
          return;
        }
        if (key.upArrow || input === "k") {
          moveResourceUp();
          return;
        }
        if (key.return && selectedResourceRow) {
          switchAdapter(selectedResourceRow.id as ServiceId);
          setResourcePickerOpen(false);
          setResourcePickerFilter("");
          setResourcePickerSearchEntry(null);
          setMode("navigate");
        }
        return;
      }

      if (input === "?") {
        if (gPrefixPending) setGPrefixPending(false);
        if (
          mode === "navigate" &&
          !uploadPending &&
          !describeState &&
          !yankMode
        ) {
          setHelpScrollOffset(0);
          setHelpTabIndex(0);
          setHelpOpen(true);
        }
        return;
      }

      if (jumpPrompt !== null) {
        if (key.escape) {
          setJumpPrompt(null);
        }
        return;
      }

      if (fetchOverwritePending) {
        if (input === "y" || input === "Y") {
          if (!adapter.fetchTo) {
            setFetchOverwritePending(null);
            return;
          }
          void adapter
            .fetchTo(
              fetchOverwritePending.row,
              fetchOverwritePending.destinationPath,
              true,
            )
            .then((savedTo) => {
              const timer = setTimeout(() => setYankFeedback(null), 2500);
              setYankFeedback({ message: `Downloaded to ${savedTo}`, timer });
            })
            .catch((err) => {
              const timer = setTimeout(() => setYankFeedback(null), 3000);
              setYankFeedback({
                message: `Fetch failed: ${(err as Error).message}`,
                timer,
              });
            })
            .finally(() => {
              setFetchOverwritePending(null);
            });
        } else if (input === "n" || input === "N" || key.escape) {
          setFetchOverwritePending(null);
        }
        return;
      }

      if (fetchPrompt) {
        if (key.escape) {
          setFetchPrompt(null);
        }
        return;
      }

      if (regionPickerOpen) {
        if (input === "G") {
          setGPrefixPending(false);
          toRegionBottom();
          return;
        }
        if (input === "g") {
          if (gPrefixPending) {
            setGPrefixPending(false);
            toRegionTop();
          } else {
            setGPrefixPending(true);
          }
          return;
        }
        if (gPrefixPending) setGPrefixPending(false);
        if (key.escape) {
          if (mode === "search") {
            if (regionPickerSearchEntry !== null && regionPickerFilter !== "") {
              setRegionPickerFilter(regionPickerSearchEntry);
            }
            setRegionPickerSearchEntry(null);
            setMode("navigate");
          } else {
            setRegionPickerOpen(false);
            setRegionPickerFilter("");
            setRegionPickerSearchEntry(null);
            setMode("navigate");
          }
          return;
        }
        if (mode === "search") return;
        if (input === "/") {
          setRegionPickerSearchEntry(regionPickerFilter);
          setMode("search");
          return;
        }
        if (key.downArrow || input === "j") {
          moveRegionDown();
          return;
        }
        if (key.upArrow || input === "k") {
          moveRegionUp();
          return;
        }
        if (key.return && selectedRegionRow) {
          setSelectedRegion(selectedRegionRow.id);
          setRegionPickerOpen(false);
          setRegionPickerFilter("");
          setRegionPickerSearchEntry(null);
          setMode("navigate");
        }
        return;
      }

      if (profilePickerOpen) {
        if (input === "G") {
          setGPrefixPending(false);
          toProfileBottom();
          return;
        }
        if (input === "g") {
          if (gPrefixPending) {
            setGPrefixPending(false);
            toProfileTop();
          } else {
            setGPrefixPending(true);
          }
          return;
        }
        if (gPrefixPending) setGPrefixPending(false);
        if (key.escape) {
          if (mode === "search") {
            if (
              profilePickerSearchEntry !== null &&
              profilePickerFilter !== ""
            ) {
              setProfilePickerFilter(profilePickerSearchEntry);
            }
            setProfilePickerSearchEntry(null);
            setMode("navigate");
          } else {
            setProfilePickerOpen(false);
            setProfilePickerFilter("");
            setProfilePickerSearchEntry(null);
            setMode("navigate");
          }
          return;
        }
        if (mode === "search") return;
        if (input === "/") {
          setProfilePickerSearchEntry(profilePickerFilter);
          setMode("search");
          return;
        }
        if (key.downArrow || input === "j") {
          moveProfileDown();
          return;
        }
        if (key.upArrow || input === "k") {
          moveProfileUp();
          return;
        }
        if (key.return && selectedProfileRow) {
          setSelectedProfile(selectedProfileRow.id);
          setProfilePickerOpen(false);
          setProfilePickerFilter("");
          setProfilePickerSearchEntry(null);
          setMode("navigate");
        }
        return;
      }

      if (uploadPending) {
        if (gPrefixPending) setGPrefixPending(false);
        if (input === "y" || input === "Y") {
          void (async () => {
            try {
              await adapter.uploadFile?.(
                uploadPending.filePath,
                uploadPending.metadata,
              );
            } catch (err) {
              console.error("Upload failed:", (err as Error).message);
            } finally {
              setUploadPending(null);
            }
          })();
        } else if (input === "n" || input === "N" || key.escape) {
          setUploadPending(null);
        }
        return;
      }

      if (describeState) {
        if (gPrefixPending) setGPrefixPending(false);
        if (key.escape) setDescribeState(null);
        return;
      }

      if (yankMode) {
        if (gPrefixPending) setGPrefixPending(false);
        if (!selectedRow) return;

        const type = selectedRow.meta?.type as string;
        const allowKey = yankOptions.some((option) => option.key === "k");
        const allowArn = yankOptions.some((option) => option.key === "a");
        const allowEtag = yankOptions.some((option) => option.key === "e");
        const allowDate = yankOptions.some((option) => option.key === "d");

        if (input === "n") {
          setYankMode(false);
          void clipboardy.write(selectedRow.cells.name ?? "").then(() => {
            pushYankFeedback("Copied Name");
          });
        } else if (input === "k" && allowKey) {
          setYankMode(false);
          let value = "";
          if (type === "bucket") {
            value = `s3://${selectedRow.id}`;
          } else if (adapter.id === "s3") {
            const keyPath = (selectedRow.meta?.key as string) ?? "";
            const bucket = path.split("/")[1] ?? "unknown";
            value = `s3://${bucket}/${keyPath}`;
          }

          if (value) {
            void clipboardy.write(value).then(() => {
              pushYankFeedback("Copied Key");
            });
          }
        } else if (input === "a" && allowArn) {
          setYankMode(false);
          let value = "";

          if (adapter.id === "iam") {
            const arn =
              (selectedRow.meta?.arn as string | undefined) ??
              (selectedRow.meta?.policyArn as string | undefined);
            value = arn ?? "";
          } else if (adapter.id === "s3") {
            if (type === "bucket") {
              value = `arn:aws:s3:::${selectedRow.id}`;
            } else if (type === "object" || type === "folder") {
              const keyPath = (selectedRow.meta?.key as string) ?? "";
              const bucket = path.split("/")[2] ?? "";
              if (bucket && keyPath) {
                value = `arn:aws:s3:::${bucket}/${keyPath}`;
              }
            }
          }

          if (value) {
            void clipboardy.write(value).then(() => {
              pushYankFeedback("Copied ARN");
            });
          }
        } else if (input === "e" && allowEtag && type === "object") {
          setYankMode(false);
          void (async () => {
            const fields = (await adapter.getDetails?.(selectedRow)) ?? [];
            const etag =
              fields.find((field) => field.label === "ETag")?.value ?? "";
            if (etag && etag !== "-") {
              await clipboardy.write(etag);
              pushYankFeedback("Copied ETag");
            }
          })();
        } else if (input === "d" && allowDate && type === "object") {
          setYankMode(false);
          void (async () => {
            const fields = (await adapter.getDetails?.(selectedRow)) ?? [];
            const lastModified =
              fields.find((field) => field.label === "Last Modified")?.value ??
              "";
            if (lastModified && lastModified !== "-") {
              await clipboardy.write(lastModified);
              pushYankFeedback("Copied Last Modified");
            }
          })();
        } else if (key.escape) {
          setYankMode(false);
        }

        return;
      }

      if (key.escape) {
        if (gPrefixPending) setGPrefixPending(false);
        if (mode === "search" || mode === "command") {
          if (
            mode === "search" &&
            searchEntryFilter !== null &&
            filterText !== ""
          ) {
            handleFilterChange(searchEntryFilter);
          }
          if (mode === "search") setSearchEntryFilter(null);
          setMode("navigate");
        } else {
          if (filterText !== "") {
            handleFilterChange("");
          } else {
            navigateBack();
          }
        }
        return;
      }

      if (key.tab) {
        if (gPrefixPending) setGPrefixPending(false);
        if (mode === "command" && commandText) {
          const match = COMMAND_SUGGESTIONS.find((cmd) =>
            cmd.toLowerCase().startsWith(commandText.toLowerCase()),
          );
          if (match) {
            setCommandText(match);
            setCommandCursorToEndToken((t) => t + 1);
          }
        }
        return;
      }

      if (mode === "search" || mode === "command") return;

      if (input === "/") {
        if (gPrefixPending) setGPrefixPending(false);
        setSearchEntryFilter(filterText);
        setMode("search");
        return;
      }

      if (input === ":") {
        if (gPrefixPending) setGPrefixPending(false);
        setCommandText("");
        setMode("command");
        return;
      }

      if (input === "q") {
        if (gPrefixPending) setGPrefixPending(false);
        exit();
        return;
      }

      if (input === "r") {
        if (gPrefixPending) setGPrefixPending(false);
        void refresh();
        return;
      }

      if (input === "y") {
        if (gPrefixPending) setGPrefixPending(false);
        setYankMode(true);
        return;
      }

      if (input === "d") {
        if (gPrefixPending) setGPrefixPending(false);
        showDetails();
        return;
      }

      if (input === "e") {
        if (gPrefixPending) setGPrefixPending(false);
        editSelection();
        return;
      }

      if (input === "f") {
        if (gPrefixPending) setGPrefixPending(false);
        openFetchPrompt();
        return;
      }

      if (input === "G") {
        setGPrefixPending(false);
        toBottom();
        return;
      }

      if (input === "p" && gPrefixPending) {
        setGPrefixPending(false);
        if (adapter.id === "s3") {
          setJumpPrompt("/");
        }
        return;
      }

      if (input === "g") {
        if (gPrefixPending) {
          setGPrefixPending(false);
          toTop();
        } else {
          setGPrefixPending(true);
        }
        return;
      }

      if (gPrefixPending) setGPrefixPending(false);

      if (key.downArrow || input === "j") {
        moveDown();
        return;
      }

      if (key.upArrow || input === "k") {
        moveUp();
        return;
      }

      if (key.return) {
        navigateIntoSelection();
      }
    },
    { isActive: true },
  );

  useEffect(() => {
    const handle = (data: Buffer) => {
      if (data.toString() === "\x03") exit();
    };

    process.stdin.on("data", handle);
    return () => {
      process.stdin.off("data", handle);
    };
  }, [exit]);

  return (
    <FullscreenBox>
      <Box flexDirection="column" width={termCols} height={termRows}>
        <HUD
          serviceLabel={adapter.label}
          hudColor={adapter.hudColor}
          path={path}
          accountName={accountName}
          accountId={accountId}
          awsProfile={awsProfile}
          currentIdentity={currentIdentity}
          region={region}
          terminalWidth={termCols}
        />
        <Box flexDirection="row" width="100%" flexGrow={1}>
          {helpOpen ? (
            <Box width="100%" borderStyle="round" borderColor="blue">
              <HelpPanel
                title="Keyboard Help"
                scopeLabel={helpScopeLabel}
                tabs={helpTabs}
                activeTab={helpTabIndex}
                terminalWidth={termCols}
                maxRows={helpVisibleRows}
                scrollOffset={helpScrollOffset}
              />
            </Box>
          ) : regionPickerOpen ? (
            <Table
              rows={filteredRegionRows}
              columns={[
                { key: "region", label: "Region" },
                { key: "description", label: "Description" },
              ]}
              selectedIndex={regionSelectedIndex}
              filterText={regionPickerFilter}
              terminalWidth={termCols}
              maxHeight={tableHeight}
              scrollOffset={regionScrollOffset}
              contextLabel="Select AWS Region"
            />
          ) : profilePickerOpen ? (
            <Table
              rows={filteredProfileRows}
              columns={[
                { key: "profile", label: "Profile" },
                { key: "description", label: "Description" },
              ]}
              selectedIndex={profileSelectedIndex}
              filterText={profilePickerFilter}
              terminalWidth={termCols}
              maxHeight={tableHeight}
              scrollOffset={profileScrollOffset}
              contextLabel="Select AWS Profile"
            />
          ) : resourcePickerOpen ? (
            <Table
              rows={filteredResourceRows}
              columns={[
                { key: "resource", label: "Resource" },
                { key: "description", label: "Description" },
              ]}
              selectedIndex={resourceSelectedIndex}
              filterText={resourcePickerFilter}
              terminalWidth={termCols}
              maxHeight={tableHeight}
              scrollOffset={resourceScrollOffset}
              contextLabel="Select AWS Resource"
            />
          ) : error ? (
            <ErrorStatePanel
              title={`Failed to load ${adapter.label}`}
              message={error}
              hint="Press r to retry"
            />
          ) : describeState ? (
            <Box width="100%" borderStyle="round" borderColor="gray">
              <DetailPanel
                title={describeState.row.cells.name ?? describeState.row.id}
                fields={describeState.fields ?? []}
                isLoading={describeState.loading}
              />
            </Box>
          ) : isLoading && filteredRows.length === 0 ? (
            <Box width="100%" borderStyle="round" borderColor="blue">
              <Box flexDirection="column" paddingX={1}>
                <Text bold color="blue">
                  Loading {adapter.label}...
                </Text>
              </Box>
            </Box>
          ) : (
            <Table
              rows={filteredRows}
              columns={columns}
              selectedIndex={selectedIndex}
              filterText={filterText}
              terminalWidth={termCols}
              maxHeight={tableHeight}
              scrollOffset={scrollOffset}
              contextLabel={adapter.getContextLabel?.() ?? ""}
            />
          )}
        </Box>
        {!helpOpen && yankFeedback && (
          <Box paddingX={1}>
            <Text color="green">{yankFeedback.message}</Text>
          </Box>
        )}
        {fetchPrompt && (
          <Box paddingX={1}>
            <Text color="cyan">Fetch to: </Text>
            <TextInput
              value={fetchPrompt.destinationPath}
              onChange={(value) =>
                setFetchPrompt((prev) =>
                  prev ? { ...prev, destinationPath: value } : prev,
                )
              }
              onSubmit={submitFetchPrompt}
              focus
            />
          </Box>
        )}
        {jumpPrompt !== null && (
          <Box paddingX={1}>
            <Text color="cyan">Jump to: </Text>
            <TextInput
              value={jumpPrompt}
              onChange={setJumpPrompt}
              onSubmit={submitJumpPrompt}
              focus
            />
          </Box>
        )}
        {fetchOverwritePending && (
          <Box paddingX={1}>
            <Text color="yellow">
              Overwrite existing file {fetchOverwritePending.finalPath}? (y/n)
            </Text>
          </Box>
        )}
        <ModeBar
          mode={mode}
          filterText={
            regionPickerOpen
              ? regionPickerFilter
              : profilePickerOpen
                ? profilePickerFilter
                : resourcePickerOpen
                  ? resourcePickerFilter
                : filterText
          }
          commandText={commandText}
          commandCursorToEndToken={commandCursorToEndToken}
          hintOverride={bottomHint}
          onFilterChange={handleFilterChange}
          onCommandChange={setCommandText}
          onFilterSubmit={handleFilterSubmit}
          onCommandSubmit={handleCommandSubmit}
        />
      </Box>
    </FullscreenBox>
  );
}
