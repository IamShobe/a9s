import { describe, expect, it } from "vitest";
import { parseCommand } from "./useCommandRouter.js";

describe("parseCommand", () => {
  it("parses picker commands", () => {
    expect(parseCommand("profiles")).toEqual({ type: "openProfiles" });
    expect(parseCommand("regions")).toEqual({ type: "openRegions" });
    expect(parseCommand("resources")).toEqual({ type: "openResources" });
  });

  it("parses region and profile setters", () => {
    expect(parseCommand("use-region EU-WEST-1")).toEqual({
      type: "setRegion",
      region: "eu-west-1",
    });

    expect(parseCommand("profile dev-admin ")).toEqual({
      type: "setProfile",
      profile: "dev-admin",
    });
  });

  it("parses service switches and quit", () => {
    expect(parseCommand("s3")).toEqual({ type: "switchService", serviceId: "s3" });
    expect(parseCommand("q")).toEqual({ type: "quit" });
    expect(parseCommand("quit")).toEqual({ type: "quit" });
  });

  it("parses watch and unwatch commands", () => {
    expect(parseCommand("watch")).toEqual({ type: "setWatch", seconds: 5 });
    expect(parseCommand("watch 10")).toEqual({ type: "setWatch", seconds: 10 });
    expect(parseCommand("watch 0")).toEqual({ type: "setWatch", seconds: 1 }); // clamped
    expect(parseCommand("unwatch")).toEqual({ type: "clearWatch" });
  });

  it("returns unknown for unsupported commands", () => {
    expect(parseCommand("something-else")).toEqual({ type: "unknown" });
  });
});
