import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createYankCapability } from "./YankCapability.js";
import { textCell } from "../../types.js";

const bucketSchema = z.object({ type: z.literal("bucket") });
const validRow = { id: "row", cells: { name: textCell("test") }, meta: { type: "bucket" } };

describe("createYankCapability", () => {
  it("propagates headerKey to public yank options", async () => {
    const capability = createYankCapability(
      [
        {
          trigger: { type: "key", char: "n" },
          label: "copy name",
          feedback: "Copied Name",
          headerKey: "name",
          isRelevant: () => true,
          resolve: async () => "hello",
        },
      ],
      bucketSchema,
      {},
    );

    const options = capability.getYankOptions(validRow);

    expect(options[0]?.headerKey).toBe("name");
    await expect(options[0]?.resolve(validRow)).resolves.toBe("hello");
  });

  it("returns empty options when Zod parse fails", () => {
    const capability = createYankCapability(
      [{ trigger: { type: "key", char: "n" }, label: "copy", feedback: "Copied", isRelevant: () => true, resolve: async () => "x" }],
      bucketSchema,
      {},
    );

    const options = capability.getYankOptions({
      id: "row",
      cells: {},
      meta: { type: "not-a-bucket" }, // fails schema
    });

    expect(options).toHaveLength(0);
  });

  it("returns only relevant options based on isRelevant", () => {
    const capability = createYankCapability(
      [
        {
          trigger: { type: "key", char: "a" },
          label: "always",
          feedback: "Always",
          isRelevant: () => true,
          resolve: async () => "always",
        },
        {
          trigger: { type: "key", char: "n" },
          label: "never",
          feedback: "Never",
          isRelevant: () => false,
          resolve: async () => "never",
        },
      ],
      bucketSchema,
      {},
    );

    const options = capability.getYankOptions(validRow);

    expect(options).toHaveLength(1);
    expect(options[0]?.label).toBe("always");
  });

  it("isRelevant on returned option correctly gates resolve", async () => {
    const capability = createYankCapability(
      [{ trigger: { type: "key", char: "n" }, label: "copy", feedback: "Copied", isRelevant: () => true, resolve: async () => "value" }],
      bucketSchema,
      {},
    );

    const options = capability.getYankOptions(validRow);
    // isRelevant returns false when the row fails schema parse
    expect(options[0]?.isRelevant({ id: "row", cells: {}, meta: { type: "other" } })).toBe(false);
    // resolve returns null when row fails schema parse
    await expect(options[0]?.resolve({ id: "row", cells: {}, meta: { type: "other" } })).resolves.toBeNull();
  });
});
