/**
 * 5.6: автоопределение целевого языка перевода по доле кириллицы. Текст
 * преимущественно на кириллице → переводим на английский, иначе → на русский.
 * Без DOM → покрыто Vitest.
 */

export type TargetLang = "ru" | "en";

/** Цель перевода: кириллица доминирует → "en", иначе → "ru". */
export function detectTargetLang(text: string): TargetLang {
  let cyr = 0;
  let lat = 0;
  for (const ch of text) {
    if (/[а-яё]/i.test(ch)) cyr++;
    else if (/[a-z]/i.test(ch)) lat++;
  }
  const letters = cyr + lat;
  if (letters === 0) return "ru";
  return cyr / letters > 0.5 ? "en" : "ru";
}
