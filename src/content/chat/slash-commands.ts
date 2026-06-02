/**
 * 4.5: slash-команды чата. Чистый модуль (Vitest): список команд, резолвер
 * «команда → промпт» и префиксный матчер для автокомплита. UI-обвязка — в panel.ts.
 */

export interface SlashCommand {
  name: string; // с ведущим слэшем, в нижнем регистре
  label: string;
  hint: string;
}

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { name: "/summary", label: "Резюме", hint: "Краткое резюме страницы" },
  { name: "/tldr", label: "TL;DR", hint: "Очень кратко, 1–3 предложения" },
  { name: "/table", label: "Таблица", hint: "Содержимое страницы таблицей" },
  { name: "/explain", label: "Объяснить", hint: "Простыми словами" },
  { name: "/translate", label: "Перевести", hint: "/translate ru|en" },
  { name: "/action-items", label: "Действия", hint: "Список действий и поручений" },
];

function languageName(arg: string): string {
  const a = arg.trim().toLowerCase();
  if (!a || a === "ru" || a === "rus" || a === "русский") return "русский";
  if (a === "en" || a === "eng" || a === "english" || a === "английский") return "английский";
  return arg.trim();
}

const PROMPT_BUILDERS: Record<string, (arg: string) => string> = {
  "/summary": () => "Сделай краткое резюме содержимого этой страницы: ключевые пункты списком.",
  "/tldr": () => "Дай TL;DR этой страницы в 1–3 предложениях.",
  "/table": () => "Представь основное содержимое этой страницы в виде markdown-таблицы.",
  "/explain": () =>
    "Объясни простыми словами содержимое этой страницы (или выделенный фрагмент, если он есть).",
  "/translate": (arg) =>
    `Переведи содержимое (или выделенный фрагмент, если он есть) на ${languageName(arg)} язык.`,
  "/action-items": () =>
    "Извлеки из содержимого этой страницы список конкретных действий и поручений.",
};

/** «команда → промпт»; не-slash или неизвестная команда → null. */
export function resolveSlashCommand(rawInput: string): { prompt: string } | null {
  const trimmed = String(rawInput ?? "").trim();
  if (!trimmed.startsWith("/")) return null;
  const spaceIdx = trimmed.indexOf(" ");
  const name = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase();
  const arg = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1);
  const builder = PROMPT_BUILDERS[name];
  return builder ? { prompt: builder(arg) } : null;
}

/** Команды для автокомплита: префиксная фильтрация, пока не начат аргумент. */
export function matchSlashCommands(line: string): SlashCommand[] {
  const trimmed = String(line ?? "").trimStart();
  if (!trimmed.startsWith("/") || trimmed.includes(" ")) return [];
  const prefix = trimmed.toLowerCase();
  return SLASH_COMMANDS.filter((c) => c.name.startsWith(prefix));
}
