/**
 * Точка входа content-скрипта (дизайн §3). Гард от повторной инъекции, слушатель
 * сообщений от background (toggle / ask-selection). Вся логика — в модулях
 * panel / context / render / security / spa-keeper.
 *
 * Собирается Vite в единый IIFE `content.js` (libs из npm бандлятся внутрь,
 * CSS — inline). MV2: инъекция по клику через injector (M4 → scripting).
 */
import { browser } from "../shared/browser";
import { togglePanel, askBySelection } from "./panel/panel";
import { initFloatingButton } from "./selection/floating-button";
import { runSelectionAction } from "./selection/actions";

declare global {
  interface Window {
    __TNE_PAGE_CHAT_LOADED__?: boolean;
  }
}

if (!window.__TNE_PAGE_CHAT_LOADED__) {
  window.__TNE_PAGE_CHAT_LOADED__ = true;

  browser.runtime.onMessage.addListener((message: unknown) => {
    const type = (message as { type?: string } | null)?.type;
    if (type === "TNE_TOGGLE_PANEL") togglePanel();
    else if (type === "TNE_ASK_SELECTION") askBySelection();
    else if (type === "TNE_SELECTION_ACTION") {
      const actionId = (message as { actionId?: string } | null)?.actionId || "explain";
      runSelectionAction(actionId);
    }
  });

  initFloatingButton();
}

export {};
