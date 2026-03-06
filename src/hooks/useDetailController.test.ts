import { describe, expect, it } from "vitest";
import {
  applyDetailError,
  applyDetailSuccess,
} from "./useDetailController.js";
import { textCell } from "../types.js";

describe("detail state stale-request guards", () => {
  const row = { id: "file.txt", cells: { name: textCell("file.txt") } };

  it("applies success only when request id is current", () => {
    const current = {
      row,
      fields: null,
      loading: true,
      requestId: 4,
    };

    const staleResult = applyDetailSuccess(current, 3, [{ label: "Size", value: "10" }]);
    expect(staleResult).toEqual(current);

    const freshResult = applyDetailSuccess(current, 4, [{ label: "Size", value: "10" }]);
    expect(freshResult?.loading).toBe(false);
    expect(freshResult?.fields).toEqual([{ label: "Size", value: "10" }]);
  });

  it("applies error only when request id is current", () => {
    const current = {
      row,
      fields: null,
      loading: true,
      requestId: 9,
    };

    const staleResult = applyDetailError(current, 8, row, new Error("boom"));
    expect(staleResult).toEqual(current);

    const freshResult = applyDetailError(current, 9, row, new Error("boom"));
    expect(freshResult?.loading).toBe(false);
    expect(freshResult?.fields?.[1]?.value).toBe("boom");
  });
});
