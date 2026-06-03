import { describe, it, expect } from "vitest";
import { dialogToMarkdown, buildExportFilename } from "../../../src/content/chat/export-md";

describe("dialogToMarkdown", () => {
  it("renders question/answer turns with headings", () => {
    const md = dialogToMarkdown([
      { role: "user", content: "Что здесь важно?" },
      { role: "assistant", content: "Главное — **дедлайн**." },
    ]);
    expect(md).toContain("## Вопрос");
    expect(md).toContain("Что здесь важно?");
    expect(md).toContain("## Ответ");
    expect(md).toContain("Главное — **дедлайн**.");
  });

  it("includes metadata block when provided", () => {
    const md = dialogToMarkdown([{ role: "user", content: "x" }], {
      title: "Карточка объекта",
      url: "https://intra.tn.corp/obj/1",
      exportedAt: "03.06.2026, 14:30",
    });
    expect(md).toContain("- **Страница:** Карточка объекта");
    expect(md).toContain("- **URL:** https://intra.tn.corp/obj/1");
    expect(md).toContain("- **Экспортировано:** 03.06.2026, 14:30");
  });

  it("omits the metadata block entirely when no meta given", () => {
    const md = dialogToMarkdown([{ role: "user", content: "x" }]);
    expect(md).not.toContain("**Страница:**");
    expect(md.startsWith("# ТНЭ чат — экспорт диалога")).toBe(true);
  });

  it("collapses excess blank lines and ends with a single newline", () => {
    const md = dialogToMarkdown([{ role: "assistant", content: "ответ\n\n\n\nещё" }]);
    expect(md).not.toMatch(/\n{3,}/);
    expect(md.endsWith("\n")).toBe(true);
    expect(md.endsWith("\n\n")).toBe(false);
  });

  it("handles an empty history (header only)", () => {
    const md = dialogToMarkdown([]);
    expect(md.trim()).toBe("# ТНЭ чат — экспорт диалога");
  });
});

describe("buildExportFilename", () => {
  const date = new Date(2026, 5, 3, 9, 5); // 2026-06-03 09:05 (month is 0-based)

  it("slugifies the title and stamps the date/time", () => {
    expect(buildExportFilename("Карточка Объекта 42", date)).toBe(
      "tne-chat-карточка-объекта-42-2026-06-03-0905.md"
    );
  });

  it("falls back to a title-less name when title is empty", () => {
    expect(buildExportFilename("", date)).toBe("tne-chat-2026-06-03-0905.md");
    expect(buildExportFilename("!!!", date)).toBe("tne-chat-2026-06-03-0905.md");
  });

  it("trims overly long titles", () => {
    const name = buildExportFilename("a".repeat(100), date);
    expect(name).toBe(`tne-chat-${"a".repeat(48)}-2026-06-03-0905.md`);
  });
});
