import { describe, expect, it } from "vitest";
import { appControllerReducer, initialAppControllerState } from "./useAppController.js";
import { textCell } from "../types.js";

describe("appControllerReducer", () => {
  it("enters and exits search mode", () => {
    const searching = appControllerReducer(initialAppControllerState, {
      type: "setMode",
      mode: "search",
    });
    expect(searching.mode).toBe("search");

    const navigating = appControllerReducer(searching, {
      type: "setMode",
      mode: "navigate",
    });
    expect(navigating.mode).toBe("navigate");
  });

  it("updates pending prompt input deterministically", () => {
    const withPrompt = appControllerReducer(initialAppControllerState, {
      type: "setPendingAction",
      value: {
        effect: {
          type: "prompt",
          label: "Path",
          nextActionId: "next",
        },
        row: null,
        inputValue: "",
        accumulatedData: {},
      },
    });

    const updated = appControllerReducer(withPrompt, {
      type: "setPendingInputValue",
      value: "s3://bucket/key",
    });

    expect(updated.pendingAction?.inputValue).toBe("s3://bucket/key");
  });

  it("supports details open and close transitions", () => {
    const opened = appControllerReducer(initialAppControllerState, {
      type: "setDescribeState",
      value: {
        row: { id: "1", cells: { name: textCell("obj") } },
        fields: null,
        loading: true,
        requestId: 1,
      },
    });
    expect(opened.describeState?.loading).toBe(true);

    const closed = appControllerReducer(opened, {
      type: "setDescribeState",
      value: null,
    });
    expect(closed.describeState).toBeNull();
  });
});
