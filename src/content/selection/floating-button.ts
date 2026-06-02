/**
 * 4.4: плавающая мини-кнопка на выделении текста → мини-меню действий
 * (SELECTION_ACTION_META) → runSelectionAction. Кнопка живёт в page DOM в
 * собственном shadow root (изоляция стилей). Активна только на whitelisted-домене.
 *
 * DOM-модуль → без юнит-тестов (§6 стиля проекта).
 */
import { readSettings } from "../../shared/settings";
import { isHostAllowed } from "../../shared/whitelist";
import { SELECTION_ACTION_META, SELECTION_MENU_PREFIX } from "../../shared/selection-actions";
import { runSelectionAction } from "./actions";
import { TNE_HOST_ID } from "../state";

const FAB_HOST_ID = "tne-selection-fab";
const MIN_SELECTION_LEN = 3;

let initialized = false;
let allowed = false;
let fabHost: HTMLElement | null = null;
let menuOpen = false;

const FAB_CSS = `
:host { all: initial; }
.tne-fab-wrap {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: #161e2e;
  border: 1px solid rgba(13, 148, 136, 0.48);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
.tne-fab-trigger, .tne-fab-action {
  cursor: pointer;
  border: none;
  border-radius: 7px;
  padding: 6px 10px;
  font-size: 12px;
  color: #f2f5fa;
  background: #1e293b;
  white-space: nowrap;
}
.tne-fab-trigger { background: #0d9488; font-weight: 600; }
.tne-fab-action:hover, .tne-fab-trigger:hover { filter: brightness(1.12); }
`;

/** Инициализация: навешивает слушатели выделения, если домен разрешён. */
export async function initFloatingButton(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const settings = await readSettings();
  allowed = isHostAllowed(location.hostname || "", settings);
  if (!allowed) return;

  document.addEventListener("mouseup", onMouseUp, true);
  document.addEventListener("selectionchange", onSelectionChange);
  document.addEventListener("mousedown", onDocMouseDown, true);
  document.addEventListener("scroll", hideFab, true);
  document.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape") hideFab();
  }, true);
}

function inOwnUi(event: Event): boolean {
  const path = (event as MouseEvent).composedPath?.() || [];
  return path.some((node) => {
    const id = (node as HTMLElement)?.id;
    return id === TNE_HOST_ID || id === FAB_HOST_ID;
  });
}

function onMouseUp(event: MouseEvent): void {
  if (inOwnUi(event)) return;
  // Дать выделению устаканиться после mouseup.
  setTimeout(showFabForSelection, 0);
}

function onSelectionChange(): void {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) hideFab();
}

function onDocMouseDown(event: MouseEvent): void {
  if (inOwnUi(event)) return;
  hideFab();
}

function showFabForSelection(): void {
  const sel = window.getSelection();
  const text = sel?.toString().trim() || "";
  if (!sel || sel.isCollapsed || text.length < MIN_SELECTION_LEN) {
    hideFab();
    return;
  }
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    hideFab();
    return;
  }
  positionFab(rect.left + rect.width / 2, rect.bottom);
}

function ensureFabHost(): ShadowRoot {
  if (fabHost?.shadowRoot) return fabHost.shadowRoot;
  fabHost = document.createElement("div");
  fabHost.id = FAB_HOST_ID;
  fabHost.style.cssText = "position:fixed;z-index:2147483646;display:none;";
  const shadow = fabHost.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = FAB_CSS;
  shadow.appendChild(style);
  document.documentElement.appendChild(fabHost);
  return shadow;
}

function positionFab(x: number, y: number): void {
  const shadow = ensureFabHost();
  if (fabHost) {
    fabHost.style.left = `${Math.max(8, Math.min(x, window.innerWidth - 8))}px`;
    fabHost.style.top = `${Math.min(y + 8, window.innerHeight - 48)}px`;
    fabHost.style.display = "block";
  }
  menuOpen = false;
  paintFab(shadow);
}

function paintFab(shadow: ShadowRoot): void {
  shadow.querySelector(".tne-fab-wrap")?.remove();
  const wrap = document.createElement("div");
  wrap.className = "tne-fab-wrap";

  if (!menuOpen) {
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "tne-fab-trigger";
    trigger.textContent = "ТНЭ";
    trigger.addEventListener("click", () => {
      menuOpen = true;
      paintFab(shadow);
    });
    wrap.appendChild(trigger);
  } else {
    SELECTION_ACTION_META.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tne-fab-action";
      button.dataset.actionId = `${SELECTION_MENU_PREFIX}${action.id}`;
      button.textContent = action.label;
      button.addEventListener("click", () => {
        hideFab();
        runSelectionAction(action.id);
      });
      wrap.appendChild(button);
    });
  }
  shadow.appendChild(wrap);
}

function hideFab(): void {
  menuOpen = false;
  if (fabHost) fabHost.style.display = "none";
}
