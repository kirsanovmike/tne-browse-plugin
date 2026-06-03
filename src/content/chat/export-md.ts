/**
 * 4.9: экспорт текущего диалога в markdown. Чистая часть (Vitest): сериализация
 * истории чата в markdown-текст и построение имени файла. DOM-обвязка (скачивание
 * Blob) — функция `exportDialog`, импортирует STATE и не покрыта юнит-тестами (§6).
 */
import type { ChatHistoryItem } from "../../shared/messages";
import { STATE } from "../state";
import { showPanelToast } from "../render/source-highlight";
import { downloadBlob } from "../render/download";

export interface DialogMeta {
  title?: string;
  url?: string;
  exportedAt?: string; // человекочитаемая дата/время
}

/** История чата → markdown-документ. Чистая: тестируется без DOM. */
export function dialogToMarkdown(history: ChatHistoryItem[], meta: DialogMeta = {}): string {
  const lines: string[] = ["# ТНЭ чат — экспорт диалога", ""];

  if (meta.title) lines.push(`- **Страница:** ${meta.title}`);
  if (meta.url) lines.push(`- **URL:** ${meta.url}`);
  if (meta.exportedAt) lines.push(`- **Экспортировано:** ${meta.exportedAt}`);
  if (meta.title || meta.url || meta.exportedAt) lines.push("");

  for (const item of history) {
    const heading = item.role === "assistant" ? "## Ответ" : "## Вопрос";
    lines.push("---", "", heading, "", String(item.content ?? "").trim(), "");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/** Имя файла экспорта: tne-chat-<slug>-<YYYY-MM-DD-HHMM>.md. Чистая. */
export function buildExportFilename(title: string | undefined, date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;

  const slug = String(title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug ? `tne-chat-${slug}-${stamp}.md` : `tne-chat-${stamp}.md`;
}

/** Скачивает текущий диалог (STATE.history) как .md-файл. DOM-обвязка. */
export function exportDialog(): void {
  if (!STATE.history.length) {
    showPanelToast("Диалог пуст — нечего экспортировать.");
    return;
  }

  const now = new Date();
  const markdown = dialogToMarkdown(STATE.history, {
    title: STATE.page?.title || document.title || undefined,
    url: STATE.page?.url || location.href,
    exportedAt: now.toLocaleString("ru-RU"),
  });

  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  void downloadBlob(blob, buildExportFilename(STATE.page?.title || document.title, now));
}
