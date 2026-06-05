/**
 * PHASE 8: SVG-иконки онбординга (тонкая обводка, currentColor). Ключи совпадают
 * с полем `icon` в tour-steps.ts и с ключами подсказок 💡.
 */
const svg = (inner: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;

export const ONBOARDING_ICONS: Record<string, string> = {
  doc: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'),
  text: svg('<path d="M4 7V5h16v2M9 19h6M12 5v14"/>'),
  download: svg('<path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/>'),
  erase: svg('<path d="M7 21h10M5 13l6-6 7 7-5 5H9z"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0 1.6 1.6 0 0 0-2.4-1.4 2 2 0 1 1-2.8-2.8A1.6 1.6 0 0 0 4 13.4 2 2 0 1 1 4 9.4 1.6 1.6 0 0 0 5 6.6a2 2 0 1 1 2.8-2.8A1.6 1.6 0 0 0 11 4a2 2 0 1 1 4 0 1.6 1.6 0 0 0 2.4 1 2 2 0 1 1 2.8 2.8 1.6 1.6 0 0 0-.3 1.8"/>'),
  camera: svg('<path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.2"/>'),
  region: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 3" aria-hidden="true" focusable="false"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`,
  clip: svg('<path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.6 1.6 0 0 1-2.3-2.3l7.4-7.4"/>'),
  table: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>'),
  cmd: svg('<path d="m12 3 1.9 4.6L19 9l-4.1 1.4L13 16l-1.9-5.6L7 9l5-1.4z"/><path d="M5 16l.8 2L8 19l-2.2.9L5 22l-.8-2L2 19l2.2-1z"/>'),
  compass: svg('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>'),
  grid: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  role: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  theme: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>'),
  help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 0 1 4.8.9c0 1.7-2.3 2.2-2.3 3.9"/><path d="M12 17h.01"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
};

/** Кнопка «?» в шапке панели. */
export const HELP_ICON = ONBOARDING_ICONS.help;
