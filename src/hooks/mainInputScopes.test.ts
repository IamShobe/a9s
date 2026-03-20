import { describe, expect, it } from "vitest";
import type { Key } from "ink";
import { KB } from "../constants/keys.js";
import {
  resolveHelpScopeAction,
  resolveNavigateScopeAction,
  resolvePickerScopeAction,
} from "./mainInputScopes.js";

describe("mainInputScopes", () => {
  const plainKey = { escape: false } as unknown as Key;
  const escapeKey = { escape: true } as unknown as Key;

  it("resolves help actions", () => {
    expect(resolveHelpScopeAction("", KB.HELP_CLOSE)).toEqual({ type: "close" });
    expect(resolveHelpScopeAction("2", null)).toEqual({ type: "goToTab", input: "2" });
  });

  it("resolves picker search consume behavior", () => {
    expect(resolvePickerScopeAction("", plainKey, "search", null, null)).toEqual({
      type: "consume",
    });
    expect(resolvePickerScopeAction("", escapeKey, "search", KB.PICKER_CLOSE, null)).toEqual({
      type: "close",
    });
  });

  it("maps navigate key actions", () => {
    expect(resolveNavigateScopeAction(KB.SEARCH_MODE)).toEqual({ type: "search" });
    expect(resolveNavigateScopeAction(KB.DETAILS)).toEqual({ type: "details" });
    expect(resolveNavigateScopeAction(null)).toEqual({ type: "none" });
  });
});
