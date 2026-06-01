/**
 * Glob-матчинг доменов и решение о допуске хоста.
 *
 * Извлечено из `content.js` (matchPattern / matchList / computeAllowed) без
 * изменения поведения — это страховочная сетка для strangler-миграции (см. дизайн
 * §6, §7 M1). Чистая логика, без DOM и extension API → покрыта Vitest.
 */

function escapeRegex(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Сопоставляет хост с одним паттерном (поддерживает `*` как glob-сегмент). */
export function matchPattern(host: string, pattern: string): boolean {
  const p = String(pattern ?? "").trim().toLowerCase();
  if (!p) return false;
  const h = String(host ?? "").toLowerCase();
  if (p.includes("*")) {
    const re = new RegExp("^" + p.split("*").map(escapeRegex).join(".*") + "$");
    return re.test(h);
  }
  return h === p || h.endsWith("." + p);
}

/** Истина, если хост подходит хотя бы под один паттерн списка. */
export function matchList(host: string, list: readonly string[]): boolean {
  return Array.isArray(list) && list.some((pattern) => matchPattern(host, pattern));
}

interface AccessRules {
  allowExternal: boolean;
  whitelist: readonly string[];
  denylist: readonly string[];
}

/** Решение о допуске: denylist > allowExternal > whitelist. */
export function isHostAllowed(host: string, rules: AccessRules): boolean {
  if (matchList(host, rules.denylist)) return false;
  if (rules.allowExternal) return true;
  return matchList(host, rules.whitelist);
}
