/**
 * SVG-иконки и логотип панели (дизайн §3). Перенесено из `content.js` на M3.
 * Логотип грузится через getURL (icons/ остаются web-accessible).
 */
import { browser } from "../../shared/browser";

export const LOGO_SRC = browser.runtime.getURL("icons/icon128.png");
export const LOGO_IMG = `<img class="tne-logo-img" src="${LOGO_SRC}" alt="ТНЭ чат по странице" />`;

export const SEND_ICON = `
    <svg class="tne-send-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.8 20.2L21 12 3.8 3.8 5.5 10.4 13.2 12 5.5 13.6 3.8 20.2Z" fill="currentColor"/>
    </svg>`;

export const ERASER_ICON = `
    <svg class="tne-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M16.9 3.8a2.2 2.2 0 0 1 3.1 0l.2.2a2.2 2.2 0 0 1 0 3.1l-8.5 8.5a3 3 0 0 1-2.1.9H6.5l-3-3 9.4-9.7Z" fill="currentColor" opacity="0.92"/>
      <path d="M3 19.2h18v1.7H3v-1.7Z" fill="currentColor" opacity="0.65"/>
      <path d="M5.2 13.5l3.3 3.3" stroke="rgba(255,255,255,.62)" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;

export const GEAR_ICON = `
    <svg class="tne-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 15.3A3.3 3.3 0 1 0 12 8.7a3.3 3.3 0 0 0 0 6.6Z" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <path d="M19.1 13.2c.1-.4.1-.8.1-1.2s0-.8-.1-1.2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-2-1.2L14.4 3h-4.8l-.4 2.6a8 8 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5c-.1.4-.1.8-.1 1.2s0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 2 1.2l.4 2.6h4.8l.4-2.6a8 8 0 0 0 2-1.2l2.4 1 2-3.5-2.1-1.5Z" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/>
    </svg>`;

export const CLOSE_ICON = `
    <svg class="tne-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6.7 6.7 17.3 17.3M17.3 6.7 6.7 17.3" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
    </svg>`;

export const FONT_ICON = `
    <svg class="tne-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 19 9.1 5h2.3l5.1 14h-2.4l-1.1-3.2H7.4L6.3 19H4Zm4.1-5.1h4.2l-2.1-6-2.1 6Z" fill="currentColor"/>
      <path d="M16.6 19v-7.8h1.8v.9c.5-.7 1.2-1.1 2.1-1.1 1.5 0 2.5 1 2.5 2.8V19h-1.9v-4.8c0-1-.5-1.5-1.3-1.5s-1.4.6-1.4 1.6V19h-1.8Z" fill="currentColor" opacity="0.78"/>
    </svg>`;

// Иконка темы (луна/солнце) — переключатель тёмной/светлой темы.
export const THEME_ICON = `
    <svg class="tne-action-icon tne-theme-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M20 14.2A8 8 0 1 1 9.8 4 6.4 6.4 0 0 0 20 14.2Z" fill="currentColor"/>
    </svg>
    <svg class="tne-action-icon tne-theme-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4" fill="currentColor"/>
      <path d="M12 2.5v2.4M12 19.1v2.4M4.3 4.3l1.7 1.7M18 18l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.3 19.7 6 18M18 6l1.7-1.7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
