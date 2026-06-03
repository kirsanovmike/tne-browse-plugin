import { describe, it, expect } from "vitest";
import { buildTableFilename } from "../../../src/content/office/table-filename";

describe("buildTableFilename", () => {
  const date = new Date(2026, 5, 3, 9, 7); // 2026-06-03 09:07 (локальное)

  it("includes a slug, table index and timestamp", () => {
    expect(buildTableFilename("Отчёт за май", 2, date)).toBe(
      "tne-table-отчёт-за-май-2-2026-06-03-0907.xlsx"
    );
  });

  it("falls back without slug when title is empty", () => {
    expect(buildTableFilename("", 1, date)).toBe("tne-table-1-2026-06-03-0907.xlsx");
    expect(buildTableFilename(undefined, 1, date)).toBe("tne-table-1-2026-06-03-0907.xlsx");
  });

  it("truncates very long titles to 48 chars of slug", () => {
    const name = buildTableFilename("a".repeat(80), 1, date);
    expect(name).toBe(`tne-table-${"a".repeat(48)}-1-2026-06-03-0907.xlsx`);
  });
});
