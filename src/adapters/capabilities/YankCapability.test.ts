import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createYankCapability } from "./YankCapability.js";
import { textCell } from "../../types.js";

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
      z.object({ type: z.literal("bucket") }),
      {},
    );

    const options = capability.getYankOptions({
      id: "row",
      cells: { name: textCell("test") },
      meta: { type: "bucket" },
    });

    expect(options[0]?.headerKey).toBe("name");
    await expect(options[0]?.resolve({ id: "row", cells: { name: textCell("test") }, meta: { type: "bucket" } })).resolves.toBe("hello");
  });
});
