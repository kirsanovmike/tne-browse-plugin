import { describe, it, expect } from "vitest";
import {
  applyTemplateVariables,
  firstTableBlock,
  parseImportedTemplates,
  newTemplateId,
  normalizeTemplate,
  withSeededDefaults,
  DEFAULT_TEMPLATES,
  TEMPLATES_KEY,
} from "../../src/shared/templates";

describe("applyTemplateVariables", () => {
  it("substitutes all three variables (case/space tolerant, repeated)", () => {
    const out = applyTemplateVariables(
      "URL: {{url}} | {{ выделение }} | {{ВЫДЕЛЕНИЕ}} | {{таблица}}",
      { selection: "S", url: "http://x", table: "T" }
    );
    expect(out).toBe("URL: http://x | S | S | T");
  });

  it("replaces a missing variable with empty string", () => {
    expect(applyTemplateVariables("a {{выделение}} b", { selection: "", url: "u", table: "t" })).toBe(
      "a  b"
    );
  });
});

describe("firstTableBlock", () => {
  it("returns the first table block up to the next section header", () => {
    const text = "[PAGE]\nTitle\n\n[TABLE T1]\n| a | b |\n| 1 | 2 |\n\n[HEADINGS]\n- h";
    expect(firstTableBlock(text)).toBe("[TABLE T1]\n| a | b |\n| 1 | 2 |");
  });

  it("returns the first of several tables", () => {
    const text = "[TABLE T1]\nfirst\n\n[TABLE T2]\nsecond";
    expect(firstTableBlock(text)).toBe("[TABLE T1]\nfirst");
  });

  it("returns empty string when there is no table", () => {
    expect(firstTableBlock("[PAGE]\nnothing here")).toBe("");
  });
});

describe("parseImportedTemplates", () => {
  it("accepts an array, drops junk, keeps label/body, generates ids", () => {
    const result = parseImportedTemplates([
      { label: "  A  ", body: "x" },
      { nope: 1 },
      "string",
      { label: "", body: "  " },
      { id: "keep", label: "B", body: "y" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]!.label).toBe("A");
    expect(result[0]!.id).toMatch(/^tpl-/);
    expect(result[1]!.id).toBe("keep");
  });

  it("throws when the root is not an array", () => {
    expect(() => parseImportedTemplates({ label: "x" })).toThrow();
  });
});

describe("newTemplateId / TEMPLATES_KEY", () => {
  it("generates prefixed ids and exposes the storage key", () => {
    expect(newTemplateId()).toMatch(/^tpl-/);
    expect(TEMPLATES_KEY).toBe("promptTemplates");
  });
});

describe("normalizeTemplate (замечание 5)", () => {
  it("trims the label and falls back to «Без названия»", () => {
    expect(normalizeTemplate({ label: "  A  ", body: "b" })).toMatchObject({ label: "A", body: "b" });
    expect(normalizeTemplate({ label: "   ", body: "b" }).label).toBe("Без названия");
  });

  it("keeps the body verbatim and generates an id when missing", () => {
    const out = normalizeTemplate({ body: "  spaced  " });
    expect(out.body).toBe("  spaced  ");
    expect(out.id).toMatch(/^tpl-/);
  });

  it("preserves an explicit id", () => {
    expect(normalizeTemplate({ id: "keep", label: "L", body: "b" }).id).toBe("keep");
  });
});

describe("withSeededDefaults (замечание 5)", () => {
  it("seeds defaults when the list is empty/null and flags seeded", () => {
    const fromEmpty = withSeededDefaults([]);
    expect(fromEmpty.seeded).toBe(true);
    expect(fromEmpty.templates).toHaveLength(DEFAULT_TEMPLATES.length);
    expect(fromEmpty.templates.map((t) => t.label)).toEqual(DEFAULT_TEMPLATES.map((t) => t.label));
    expect(withSeededDefaults(null).seeded).toBe(true);
    expect(withSeededDefaults(undefined).seeded).toBe(true);
  });

  it("returns a copy of defaults, not the shared constant", () => {
    const seeded = withSeededDefaults([]).templates;
    seeded[0]!.label = "mutated";
    expect(DEFAULT_TEMPLATES[0]!.label).not.toBe("mutated");
  });

  it("returns the existing list untouched when non-empty", () => {
    const existing = [{ id: "x", label: "L", body: "b" }];
    const out = withSeededDefaults(existing);
    expect(out.seeded).toBe(false);
    expect(out.templates).toBe(existing);
  });
});
