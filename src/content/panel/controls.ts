/**
 * Контролы панели: размер шрифта, тема (тёмная/светлая), изменение ширины (drag).
 * Состояние сохраняется в storage.local между сессиями (Phase 1.15).
 *
 * Перенесено из `content.js` при декомпозиции на M3. DOM → без юнит-тестов (§6).
 */
import { browser } from "../../shared/browser";
import {
  STATE,
  FONT_SIZE_KEY,
  MIN_PANEL_FONT_SIZE,
  MAX_PANEL_FONT_SIZE,
  THEME_KEY,
  WIDTH_KEY,
  MIN_PANEL_WIDTH,
  MAX_PANEL_WIDTH,
  type Theme,
} from "../state";

// ── Размер шрифта ───────────────────────────────────────────────────────────

export async function initFontControls(root: HTMLElement): Promise<void> {
  const saved = await browser.storage.local.get([FONT_SIZE_KEY]);
  applyPanelFontSize(root, clampFontSize(saved[FONT_SIZE_KEY]));

  const wrap = root.querySelector("#tne-font-menu-wrap");
  const trigger = root.querySelector("#tne-font-trigger");
  const minus = root.querySelector("#tne-font-minus");
  const plus = root.querySelector("#tne-font-plus");

  trigger?.addEventListener("click", (event) => {
    event.stopPropagation();
    wrap?.classList.toggle("tne-font-menu-wrap--open");
  });
  minus?.addEventListener("click", () => changePanelFontSize(-1));
  plus?.addEventListener("click", () => changePanelFontSize(1));

  document.addEventListener(
    "click",
    (event) => {
      const path = event.composedPath ? event.composedPath() : [];
      if (wrap && path.includes(wrap)) return;
      wrap?.classList.remove("tne-font-menu-wrap--open");
    },
    true
  );
}

function clampFontSize(value: unknown): number {
  const numeric = Number(value) || MIN_PANEL_FONT_SIZE;
  return Math.max(MIN_PANEL_FONT_SIZE, Math.min(MAX_PANEL_FONT_SIZE, numeric));
}

function getCurrentPanelFontSize(): number {
  const raw = STATE.panel?.style.getPropertyValue("--tne-content-font-size") || `${MIN_PANEL_FONT_SIZE}px`;
  return clampFontSize(parseInt(raw, 10));
}

async function changePanelFontSize(delta: number): Promise<void> {
  if (!STATE.panel) return;
  const next = clampFontSize(getCurrentPanelFontSize() + delta);
  applyPanelFontSize(STATE.panel, next);
  await browser.storage.local.set({ [FONT_SIZE_KEY]: next });
}

function applyPanelFontSize(root: HTMLElement, size: number): void {
  const value = clampFontSize(size);
  root.style.setProperty("--tne-content-font-size", `${value}px`);
  const label = root.querySelector("#tne-font-size-label");
  if (label) label.textContent = String(value);
}

// ── Тема (тёмная/светлая) ───────────────────────────────────────────────────

export async function initThemeControl(root: HTMLElement): Promise<void> {
  const saved = await browser.storage.local.get([THEME_KEY]);
  applyTheme(root, saved[THEME_KEY] === "light" ? "light" : "dark");
}

function applyTheme(root: HTMLElement, theme: Theme): void {
  const value: Theme = theme === "light" ? "light" : "dark";
  STATE.theme = value;
  root.dataset.theme = value;
  const toggle = root.querySelector("#tne-theme-toggle");
  if (toggle) (toggle as HTMLElement).title = value === "light" ? "Тёмная тема" : "Светлая тема";
}

export async function toggleTheme(): Promise<void> {
  if (!STATE.panel) return;
  const next: Theme = STATE.theme === "light" ? "dark" : "light";
  applyTheme(STATE.panel, next);
  await browser.storage.local.set({ [THEME_KEY]: next });
}

// ── Изменение ширины панели ─────────────────────────────────────────────────

export async function initResizeHandle(root: HTMLElement): Promise<void> {
  const saved = await browser.storage.local.get([WIDTH_KEY]);
  const width = Number(saved[WIDTH_KEY]);
  if (width) applyPanelWidth(root, width);

  const handle = root.querySelector("#tne-resize-handle");
  if (!handle) return;

  let dragging = false;

  const onMove = (event: PointerEvent): void => {
    if (!dragging) return;
    const next = clampPanelWidth(window.innerWidth - event.clientX);
    root.style.setProperty("--tne-panel-width", `${next}px`);
  };

  const onUp = async (): Promise<void> => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove("tne-resizing");
    window.removeEventListener("pointermove", onMove, true);
    window.removeEventListener("pointerup", onUp, true);
    const current = parseInt(root.style.getPropertyValue("--tne-panel-width"), 10);
    if (current) await browser.storage.local.set({ [WIDTH_KEY]: clampPanelWidth(current) });
  };

  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    dragging = true;
    root.classList.add("tne-resizing");
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
  });

  // Двойной клик по ручке — сброс ширины к значению по умолчанию.
  handle.addEventListener("dblclick", async () => {
    root.style.removeProperty("--tne-panel-width");
    await browser.storage.local.remove(WIDTH_KEY);
  });
}

function clampPanelWidth(value: number): number {
  const numeric = Number(value) || MIN_PANEL_WIDTH;
  const maxByViewport = Math.max(MIN_PANEL_WIDTH, window.innerWidth - 24);
  return Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, maxByViewport, numeric));
}

function applyPanelWidth(root: HTMLElement, width: number): void {
  root.style.setProperty("--tne-panel-width", `${clampPanelWidth(width)}px`);
}
