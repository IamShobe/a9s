import { describe, expect, it } from "vitest";
import { deriveYankHeaderMarkers } from "./yankHeaderMarkers.js";

describe("deriveYankHeaderMarkers", () => {
  it("returns undefined when yank mode is inactive", () => {
    const result = deriveYankHeaderMarkers(false, [
      {
        trigger: { type: "key", char: "n" },
        label: "copy name",
        feedback: "copied",
        headerKey: "name",
        isRelevant: () => true,
        resolve: async () => "x",
      },
    ]);
    expect(result).toBeUndefined();
  });

  it("groups key triggers by header key", () => {
    const result = deriveYankHeaderMarkers(true, [
      {
        trigger: { type: "key", char: "n" },
        label: "copy name",
        feedback: "copied",
        headerKey: "name",
        isRelevant: () => true,
        resolve: async () => "x",
      },
      {
        trigger: { type: "key", char: "d" },
        label: "copy lm",
        feedback: "copied",
        headerKey: "lastModified",
        isRelevant: () => true,
        resolve: async () => "x",
      },
      {
        trigger: { type: "special", name: "return" },
        label: "ignored",
        feedback: "copied",
        headerKey: "name",
        isRelevant: () => true,
        resolve: async () => "x",
      },
    ]);

    expect(result).toEqual({
      name: ["n"],
      lastModified: ["d"],
    });
  });
});
