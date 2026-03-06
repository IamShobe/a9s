import { describe, expect, it, vi } from "vitest";
import type { Key } from "ink";
import { KB } from "../constants/keys.js";
import {
  applyInputEvent,
  resolveAdapterBindingEvent,
  translateRawInputEvent,
} from "./useInputEventProcessor.js";
import type { InputRuntimeState } from "./inputEvents.js";

const key = (patch: Partial<Key> = {}): Key =>
  ({
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageDown: false,
    pageUp: false,
    home: false,
    end: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    meta: false,
    ...patch,
  }) as Key;

const baseRuntime: InputRuntimeState = {
  mode: "navigate",
  filterText: "",
  commandText: "",
  searchEntryFilter: null,
  yankMode: false,
  selectedRow: null,
  helpOpen: false,
  pickerMode: null,
  describeOpen: false,
  uploadPending: false,
  pendingActionType: null,
};

describe("translateRawInputEvent", () => {
  it("maps help scope actions first", () => {
    const result = translateRawInputEvent(
      "",
      key(),
      { ...baseRuntime, helpOpen: true },
      {
        resolve: () => KB.HELP_CLOSE,
        hasCommandAutocomplete: () => false,
      },
    );

    expect(result).toEqual({
      event: { scope: "help", type: "close" },
      resetChord: true,
    });
  });

  it("consumes picker search typing", () => {
    const result = translateRawInputEvent(
      "a",
      key(),
      { ...baseRuntime, pickerMode: "search" },
      {
        resolve: () => null,
        hasCommandAutocomplete: () => false,
      },
    );

    expect(result).toEqual({ event: null, resetChord: false });
  });

  it("maps pending confirm y/n", () => {
    const yes = translateRawInputEvent(
      "y",
      key(),
      { ...baseRuntime, pendingActionType: "confirm" },
      {
        resolve: () => null,
        hasCommandAutocomplete: () => false,
      },
    );

    expect(yes.event).toEqual({ scope: "pending", type: "submit", confirmed: true });
  });
});

describe("resolveAdapterBindingEvent", () => {
  it("resolves adapter chord keybindings like g p", () => {
    const row = { id: "row-1", cells: { name: "n" } };
    const first = resolveAdapterBindingEvent(
      "g",
      key(),
      [{ trigger: { type: "chord", keys: ["g", "p"] }, actionId: "jump-to-path", label: "jump" }],
      [],
      row,
    );
    expect(first.event).toBeNull();
    expect(first.nextPending).toEqual(["g"]);

    const second = resolveAdapterBindingEvent(
      "p",
      key(),
      [{ trigger: { type: "chord", keys: ["g", "p"] }, actionId: "jump-to-path", label: "jump" }],
      first.nextPending,
      row,
    );

    expect(second.event).toEqual({
      scope: "adapterAction",
      type: "run",
      actionId: "jump-to-path",
      row,
    });
  });
});

describe("applyInputEvent", () => {
  it("routes event to grouped action handlers", () => {
    const actions = {
      app: { exit: vi.fn() },
      help: {
        open: vi.fn(),
        close: vi.fn(),
        prevTab: vi.fn(),
        nextTab: vi.fn(),
        scrollUp: vi.fn(),
        scrollDown: vi.fn(),
        goToTab: vi.fn(),
      },
      picker: {
        close: vi.fn(),
        cancelSearch: vi.fn(),
        startSearch: vi.fn(),
        moveDown: vi.fn(),
        moveUp: vi.fn(),
        top: vi.fn(),
        bottom: vi.fn(),
        confirm: vi.fn(),
      },
      mode: {
        cancelSearchOrCommand: vi.fn(),
        clearFilterOrNavigateBack: vi.fn(),
        startSearch: vi.fn(),
        startCommand: vi.fn(),
        commandAutocomplete: vi.fn(),
      },
      navigation: {
        refresh: vi.fn(),
        showDetails: vi.fn(),
        editSelection: vi.fn(),
        down: vi.fn(),
        up: vi.fn(),
        top: vi.fn(),
        bottom: vi.fn(),
        enter: vi.fn(),
      },
      yank: {
        enter: vi.fn(),
        cancel: vi.fn(),
      },
      details: {
        close: vi.fn(),
      },
      pending: {
        cancelPrompt: vi.fn(),
        submit: vi.fn(),
      },
      upload: {
        decide: vi.fn(),
      },
      adapterAction: {
        run: vi.fn(),
        bindings: [],
      },
    };

    applyInputEvent({ scope: "navigation", type: "refresh" }, actions);
    expect(actions.navigation.refresh).toHaveBeenCalledTimes(1);

    applyInputEvent({ scope: "modal", type: "openHelp" }, actions);
    expect(actions.help.open).toHaveBeenCalledTimes(1);
  });
});
