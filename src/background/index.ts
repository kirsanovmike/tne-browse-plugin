/**
 * Точка входа background-скрипта (дизайн §3). Регистрирует слушатели и делегирует
 * логику в модули llm-client / diagnostics / injector / messaging.
 *
 * M4: MV3. Firefox — event page (`background.scripts`), Chromium — service
 * worker (M5); state (abort-контроллеры) живёт только в рамках запроса,
 * диагностика — в `storage.session`. Регистрация слушателей — на верхнем уровне
 * (требование MV3: подписки до первого тика воркера).
 */
import { browser } from "../shared/browser";
import { DEFAULT_SETTINGS } from "../shared/settings";
import { sendOrInject } from "./injector";
import { routeMessage } from "./messaging";

// Засеять дефолты при установке/обновлении (token не трогаем).
browser.runtime.onInstalled.addListener(async () => {
  const current = await browser.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const saved = current[key];
    const missing = saved === undefined || saved === null || saved === "";
    if (missing && key !== "token") patch[key] = value;
  }

  if (Object.keys(patch).length) await browser.storage.local.set(patch);
});

// Клик по кнопке на тулбаре — открыть/закрыть панель (внедрив при первом клике).
// MV3: browser_action → action.
browser.action.onClicked.addListener((tab) => {
  if (!tab || tab.id === undefined) return;
  sendOrInject(tab.id, { type: "TNE_TOGGLE_PANEL" }).catch((error) =>
    console.error("TNE chat injection failed", error)
  );
});

// Хоткеи (1.15): открытие панели вешается на _execute_action (зарезервированная
// команда, браузер сам шлёт action.onClicked), «спросить по выделению» — отдельная.
browser.commands.onCommand.addListener(async (command) => {
  if (command !== "tne-ask-selection") return;
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id !== undefined) await sendOrInject(tab.id, { type: "TNE_ASK_SELECTION" });
  } catch (error) {
    console.error("TNE chat ask-selection failed", error);
  }
});

browser.runtime.onMessage.addListener((message: unknown) => routeMessage(message));
