/**
 * Обрезка структурированного контекста по приоритету (дизайн §3, §7 M3).
 *
 * Перенесено из `content.js` (trimSectionsByPriority / renderSections) без
 * изменения поведения. Чистая логика → покрыта Vitest.
 */
import { DEFAULT_SETTINGS, MAX_CONTEXT_HARD_LIMIT } from "../../shared/settings";

const DEFAULT_MAX_CONTEXT = DEFAULT_SETTINGS.maxContextChars;

/** Блок контекста: тег, видимый заголовок, тело и приоритет (меньше — ценнее). */
export interface Section {
  tag: string;
  header: string;
  body: string;
  priority: number;
}

/** Режет блоки по приоритету: самое ценное (меньший priority) режется последним. */
export function trimSectionsByPriority(sections: Section[], maxChars: number): Section[] {
  const limit = Math.min(Number(maxChars) || DEFAULT_MAX_CONTEXT, MAX_CONTEXT_HARD_LIMIT);
  const ordered = [...sections].sort((a, b) => a.priority - b.priority);

  let used = 0;
  const kept = new Map<Section, string>();
  const OVERHEAD = 12; // приблизительно на заголовок блока и переносы строк

  for (const section of ordered) {
    if (used >= limit) break;
    const available = limit - used - OVERHEAD;
    if (available <= 40) break;
    let body = section.body || "";
    if (body.length > available) {
      body = `${body.slice(0, available)}\n[…блок сокращён по лимиту контекста…]`;
    }
    kept.set(section, body);
    used += body.length + OVERHEAD;
  }

  return sections
    .filter((section) => kept.has(section))
    .map((section) => ({ ...section, body: kept.get(section)! }));
}

/** Склеивает блоки в финальный текст контекста: «header\nbody», блоки через пустую строку. */
export function renderSections(sections: Section[]): string {
  return sections
    .map((section) => `${section.header}\n${section.body}`.trim())
    .filter(Boolean)
    .join("\n\n");
}
