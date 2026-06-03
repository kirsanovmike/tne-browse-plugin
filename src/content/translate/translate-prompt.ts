/**
 * 5.6: чистая сборка «plain»-промпта перевода — просим вернуть только перевод,
 * без пояснений и оформления. Без DOM → покрыто Vitest.
 */
import type { TargetLang } from "./lang-detect";

const LANG_NAME: Record<TargetLang, string> = {
  ru: "русский",
  en: "английский",
};

/** Промпт перевода фрагмента на целевой язык; модель должна вернуть только перевод. */
export function buildTranslatePrompt(text: string, target: TargetLang): string {
  return [
    `Переведи следующий текст на ${LANG_NAME[target]} язык.`,
    "Верни только перевод, без пояснений, кавычек и markdown. Сохрани смысл и деловой стиль.",
    "",
    text,
  ].join("\n");
}
