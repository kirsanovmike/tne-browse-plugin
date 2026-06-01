/**
 * Скан контекста на чувствительные данные перед отправкой (дизайн §3, §7 M3;
 * Phase 1.11). JWT / провайдерские ключи / длинный hex / номера карт по Luhn.
 *
 * Перенесено из `content.js` без изменения поведения. Чистая логика → Vitest.
 */

/** Возвращает список человекочитаемых находок (без дублей) для предупреждения. */
export function scanSensitive(text: string | null | undefined): string[] {
  const findings = new Set<string>();
  const value = String(text || "");

  // JWT
  if (/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\b/.test(value)) findings.add("токен (JWT)");
  // Bearer / распространённые ключи
  if (/\b(?:sk|pk|ghp|gho|xox[baprs])[-_][A-Za-z0-9]{16,}\b/.test(value)) findings.add("API-ключ");
  // Длинный hex (возможный ключ/хеш)
  if (/\b[A-Fa-f0-9]{40,}\b/.test(value)) findings.add("ключ/хеш");
  // Номера карт (по Luhn)
  if (hasLuhnCardNumber(value)) findings.add("номер карты");

  return [...findings];
}

/** Истина, если в тексте есть последовательность цифр, проходящая Luhn как карта. */
export function hasLuhnCardNumber(text: string | null | undefined): boolean {
  const candidates = String(text || "").match(/\b(?:\d[ -]?){13,19}\b/g) || [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/[ -]/g, "");
    if (digits.length < 13 || digits.length > 19) continue;
    if (luhnValid(digits)) return true;
  }
  return false;
}

/** Проверка контрольной суммы Luhn для строки цифр. */
export function luhnValid(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = parseInt(digits[i]!, 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}
