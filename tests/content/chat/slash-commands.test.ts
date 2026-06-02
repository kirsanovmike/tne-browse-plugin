import { describe, it, expect } from "vitest";
import {
  SLASH_COMMANDS,
  resolveSlashCommand,
  matchSlashCommands,
} from "../../../src/content/chat/slash-commands";

describe("resolveSlashCommand", () => {
  it("returns null for non-slash input", () => {
    expect(resolveSlashCommand("просто вопрос")).toBeNull();
  });

  it("returns null for an unknown command", () => {
    expect(resolveSlashCommand("/unknown")).toBeNull();
  });

  it("resolves a known command (case-insensitive)", () => {
    expect(resolveSlashCommand("/TLDR")!.prompt).toContain("TL;DR");
  });

  it("uses the argument for /translate (default russian)", () => {
    expect(resolveSlashCommand("/translate")!.prompt).toContain("русский");
    expect(resolveSlashCommand("/translate en")!.prompt).toContain("английский");
  });
});

describe("matchSlashCommands", () => {
  it("returns all commands for a lone slash", () => {
    expect(matchSlashCommands("/")).toHaveLength(SLASH_COMMANDS.length);
  });

  it("prefix-filters by typed text", () => {
    const names = matchSlashCommands("/t").map((c) => c.name);
    expect(names).toContain("/tldr");
    expect(names).toContain("/table");
    expect(names).toContain("/translate");
    expect(names).not.toContain("/summary");
  });

  it("returns nothing once an argument is being typed or for non-slash", () => {
    expect(matchSlashCommands("/translate ")).toEqual([]);
    expect(matchSlashCommands("hello")).toEqual([]);
  });
});
