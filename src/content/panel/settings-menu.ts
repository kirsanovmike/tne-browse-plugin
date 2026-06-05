/**
 * Выпадающее меню настроек в шапке (доработки п. 2). Редко используемые действия
 * (роль, размер текста, тема, экспорт, очистка, обучение, настройки расширения,
 * ссылка на веб-ассистент) спрятаны под одну кнопку-триггер `#tne-chat-menu`.
 *
 * Отдельный модуль (не panel.ts), чтобы тур (tour.ts) мог открывать/закрывать
 * меню без кругового импорта (panel.ts → onboarding → tour.ts).
 *
 * DOM → без юнит-тестов (§6).
 */
import { STATE } from "../state";

const MENU_ID = "tne-settings-menu";
const TRIGGER_ID = "tne-chat-menu";
const OPEN_CLASS = "tne-settings-menu--open";

/**
 * Замок: пока true, меню нельзя закрыть кликом вне/Esc/выбором пункта — им
 * управляет тур (держит меню открытым на шагах role/font/theme/export/clear).
 */
let locked = false;

function menuEl(): HTMLElement | null {
  return (STATE.panel?.querySelector(`#${MENU_ID}`) as HTMLElement | null) ?? null;
}

function triggerEl(): HTMLElement | null {
  return (STATE.panel?.querySelector(`#${TRIGGER_ID}`) as HTMLElement | null) ?? null;
}

export function isSettingsMenuOpen(): boolean {
  return menuEl()?.classList.contains(OPEN_CLASS) ?? false;
}

export function openSettingsMenu(): void {
  const menu = menuEl();
  if (!menu || menu.classList.contains(OPEN_CLASS)) return;
  menu.classList.add(OPEN_CLASS);
  triggerEl()?.setAttribute("aria-expanded", "true");
}

export function closeSettingsMenu(): void {
  const menu = menuEl();
  if (!menu || !menu.classList.contains(OPEN_CLASS)) return;
  menu.classList.remove(OPEN_CLASS);
  triggerEl()?.setAttribute("aria-expanded", "false");
}

/** Тур держит меню принудительно открытым; снимает замок при выходе. */
export function setSettingsMenuLock(value: boolean): void {
  locked = value;
}

/** Закрывает меню, только если им не управляет тур. */
function closeUnlessLocked(): void {
  if (!locked) closeSettingsMenu();
}

/** Навешивает обработчики на триггер и меню. Вызывается один раз при сборке UI. */
export function initSettingsMenu(root: HTMLElement): void {
  const menu = root.querySelector(`#${MENU_ID}`) as HTMLElement | null;
  const trigger = root.querySelector(`#${TRIGGER_ID}`) as HTMLElement | null;
  if (!menu || !trigger) return;

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    if (isSettingsMenuOpen()) closeSettingsMenu();
    else openSettingsMenu();
  });

  // Выбор пункта-действия (role="menuitem") закрывает меню; контролы внутри
  // (роль, шаги размера текста — role="group") меню не закрывают.
  menu.addEventListener("click", (event) => {
    if (locked) return;
    const item = (event.target as HTMLElement | null)?.closest?.('[role="menuitem"]');
    if (item) closeUnlessLocked();
  });

  // Клик вне меню (и не по триггеру) — закрыть. composedPath учитывает shadow DOM.
  document.addEventListener(
    "click",
    (event) => {
      if (!isSettingsMenuOpen() || locked) return;
      const path = (event as Event).composedPath ? event.composedPath() : [];
      if (path.includes(menu) || path.includes(trigger)) return;
      closeSettingsMenu();
    },
    true,
  );
}
