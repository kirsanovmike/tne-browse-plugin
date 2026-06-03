/**
 * Глобальное состояние content-скрипта, константы панели и доступ к shadow DOM.
 *
 * Перенесено из IIFE `content.js` (STATE + константы + `$`) при декомпозиции на
 * M3. Единый мутируемый синглтон `STATE`, который импортируют остальные модули.
 */
import type { ChatHistoryItem } from "../shared/messages";
import type { PageContext } from "./context/build-context";

// Хост живёт в обычном DOM страницы, сама панель — внутри его shadow root.
export const TNE_HOST_ID = "tne-page-chat-host";
export const PANEL_ROOT_ID = "tne-page-chat-root";

export const FONT_SIZE_KEY = "panelFontSize";
export const MIN_PANEL_FONT_SIZE = 12;
export const MAX_PANEL_FONT_SIZE = 18;

export const THEME_KEY = "panelTheme";
export const DEFAULT_THEME = "dark";
export const WIDTH_KEY = "panelWidth";
export const MIN_PANEL_WIDTH = 360;
export const MAX_PANEL_WIDTH = 900;

// Опции наблюдателя за DOM (1.5/1.13) — выносим, чтобы переподключать на новый <body>.
export const OBSERVER_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["value", "placeholder", "title", "aria-label", "aria-labelledby", "class", "style", "hidden", "aria-hidden"],
};

export type ScopeId = "all" | "visible" | "selection" | "tables";

export interface ScopeOption {
  id: ScopeId;
  label: string;
  /** Пояснение к режиму (тултип): что собирает и когда использовать. */
  hint: string;
}

// 5.R2-11: оставлены два главных режима. «Видимое» и «Таблицы» убраны как
// нишевые (экспорт таблиц живёт отдельной кнопкой). ScopeId сохраняет старые
// значения для совместимости логики сбора, но в UI они не предлагаются.
export const SCOPES: readonly ScopeOption[] = [
  {
    id: "all",
    label: "Вся страница",
    hint: "Беру весь значимый текст страницы — основной контент, заголовки, формы и таблицы.",
  },
  {
    id: "selection",
    label: "Только выделенное",
    hint: "Отвечаю строго по выделенному на странице тексту, без остального содержимого.",
  },
];

export interface QuickAction {
  label: string;
  prompt: string;
}

// 5.R2-4: три самых нужных быстрых действия, адаптивный ряд (см. .tne-quick-actions).
export const QUICK_ACTIONS: readonly QuickAction[] = [
  { label: "Что здесь важно?", prompt: "Что на этой странице самое важное? Кратко перечисли ключевые моменты." },
  { label: "Кратко объясни", prompt: "Кратко и простыми словами объясни, что это за страница и о чём она." },
  { label: "Найди ошибки", prompt: "Проверь содержимое страницы на ошибки, несоответствия и подозрительные места." },
];

export type Theme = "dark" | "light";

export interface Attachment {
  id: string;
  dataUrl: string; // сжатый превью
  base64: string; // чистый base64 для отправки
  source: "screenshot" | "region" | "upload" | "pdf";
  bytes: number;
  name?: string;
  page?: number; // номер страницы PDF (для source: "pdf")
}

export interface PdfState {
  name: string;
  numPages: number;
  selectionMode: "first5" | "choose" | "current";
  selectionInput: string; // сырой ввод для режима «choose»
  pages: number[]; // разобранные номера выбранных страниц
  currentPage: number | null; // если PDF открыт во вкладке и страница известна
  hasTextLayer: boolean;
  withImages: boolean; // прикладывать ли страницы картинками
  documentText: string; // готовое тело блока [DOCUMENT]
}

export interface ContentState {
  opened: boolean;
  allowed: boolean | null;
  shadow: ShadowRoot | null;
  panel: HTMLElement | null;
  scope: ScopeId;
  page: PageContext | null;
  blockMap: Record<string, Element>;
  history: ChatHistoryItem[];
  attachments: Attachment[];
  pdf: PdfState | null;
  isSending: boolean;
  currentRequestId: string | null;
  lastQuestion: string;
  lastRequestHadImages: boolean;
  lastUrl: string;
  urlWatchStarted: boolean;
  domWatchStarted: boolean;
  domObserver: MutationObserver | null;
  observedTarget: Node | null;
  domInputHandler: ((event: Event) => void) | null;
  contextDirty: boolean;
  lastContextRefreshAt: number;
  refreshTimer: number;
  searchRoots: Array<Document | ShadowRoot> | null;
  theme: Theme;
}

export const STATE: ContentState = {
  opened: false,
  allowed: null,
  shadow: null,
  panel: null,
  scope: "all",
  page: null,
  blockMap: {},
  history: [],
  attachments: [],
  pdf: null,
  isSending: false,
  currentRequestId: null,
  lastQuestion: "",
  lastRequestHadImages: false,
  lastUrl: location.href,
  urlWatchStarted: false,
  domWatchStarted: false,
  domObserver: null,
  observedTarget: null,
  domInputHandler: null,
  contextDirty: false,
  lastContextRefreshAt: 0,
  refreshTimer: 0,
  searchRoots: null,
  theme: DEFAULT_THEME,
};

/** querySelector внутри shadow root панели. */
export function $(selector: string): HTMLElement | null {
  return STATE.shadow ? STATE.shadow.querySelector<HTMLElement>(selector) : null;
}
