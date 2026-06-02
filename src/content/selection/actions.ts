/**
 * 4.4: промпты действий по выделению (поверх shared-meta) и их исполнение.
 * `selectionPromptFor` — чистая (покрыта Vitest); `runSelectionAction` —
 * оркестратор поверх askWithSelectionPrompt (DOM, ручная проверка).
 */
import { askWithSelectionPrompt } from "../panel/panel";

const SELECTION_PROMPTS: Record<string, string> = {
  explain: "Объясни выделенный фрагмент простыми словами.",
  summarize: "Кратко суммаризируй выделенный фрагмент.",
  translate: "Переведи выделенный фрагмент на русский язык.",
  simplify: "Упрости выделенный фрагмент, сохранив смысл.",
};

/** Промпт по id действия; неизвестный id → промпт «объяснить». */
export function selectionPromptFor(actionId: string): string {
  return SELECTION_PROMPTS[actionId] ?? SELECTION_PROMPTS.explain!;
}

/** Запускает действие по выделению: открыть панель в режиме «Выделение» и спросить. */
export async function runSelectionAction(actionId: string): Promise<void> {
  await askWithSelectionPrompt(selectionPromptFor(actionId));
}
