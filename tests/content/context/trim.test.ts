import { describe, it, expect } from "vitest";
import { trimSectionsByPriority, renderSections, type Section } from "../../../src/content/context/trim";

const sec = (tag: string, priority: number, body: string): Section => ({
  tag,
  header: `[${tag}]`,
  body,
  priority,
});

describe("trimSectionsByPriority", () => {
  it("keeps all sections when comfortably under the limit", () => {
    const out = trimSectionsByPriority([sec("PAGE", 0, "abc"), sec("MAIN", 7, "def")], 1000);
    expect(out.map((s) => s.tag)).toEqual(["PAGE", "MAIN"]);
    expect(out.map((s) => s.body)).toEqual(["abc", "def"]);
  });

  it("preserves the original (non-priority) order in the output", () => {
    const sections = [sec("MAIN", 7, "main"), sec("SELECTED", 1, "sel")];
    const out = trimSectionsByPriority(sections, 1000);
    // вход: MAIN, SELECTED — выход сохраняет входной порядок, не приоритетный
    expect(out.map((s) => s.tag)).toEqual(["MAIN", "SELECTED"]);
  });

  it("drops the lowest-priority sections first when over the limit", () => {
    const big = "x".repeat(400);
    // приоритет 1 (SELECTED) ценнее приоритета 8 (INTERFACE) → INTERFACE режется первым
    const sections = [sec("SELECTED", 1, big), sec("INTERFACE", 8, big)];
    const out = trimSectionsByPriority(sections, 450);
    expect(out.map((s) => s.tag)).toEqual(["SELECTED"]);
  });

  it("truncates an oversized body with the limit marker", () => {
    const out = trimSectionsByPriority([sec("MAIN", 7, "y".repeat(1000))], 300);
    expect(out).toHaveLength(1);
    expect(out[0]!.body).toContain("[…блок сокращён по лимиту контекста…]");
  });
});

describe("renderSections", () => {
  it("joins header + body of each section with blank lines between blocks", () => {
    const out = renderSections([sec("PAGE", 0, "title: x"), sec("MAIN", 7, "body")]);
    expect(out).toBe("[PAGE]\ntitle: x\n\n[MAIN]\nbody");
  });
});
