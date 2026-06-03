/**
 * 4.4: метаданные действий по выделению (id + label), общие для background
 * (пункты contextMenus) и content (плавающая кнопка). Промпты исполнения живут в
 * content (`src/content/selection/actions.ts`), т.к. нужны только при запуске.
 */

export interface SelectionActionMeta {
  id: string;
  label: string;
}

export const SELECTION_ACTION_META: readonly SelectionActionMeta[] = [
  { id: "explain", label: "Объяснить" },
  { id: "summarize", label: "Суммаризировать" },
  { id: "translate", label: "Перевести" },
  { id: "simplify", label: "Упростить" },
  // 5.6: перевод прямо на странице (замена выделения с откатом), не в чат.
  { id: "translate-inplace", label: "Перевести на месте" },
];

/** Префикс id пунктов контекстного меню (`tne-sel-explain` и т.д.). */
export const SELECTION_MENU_PREFIX = "tne-sel-";
