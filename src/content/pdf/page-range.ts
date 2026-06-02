/**
 * Чистый парсер пользовательского выбора страниц PDF («1-3,12»).
 * Нормализует обратные диапазоны, дедуплицирует, сортирует, клампит к [1, numPages].
 * Невалидные/вне диапазона части отбрасываются. Покрыт Vitest (Phase 3).
 */
export function parsePageRange(input: string, numPages: number): number[] {
  const pages = new Set<number>();
  for (const part of String(input).split(",")) {
    const token = part.trim();
    if (!token) continue;
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      let from = Number(range[1]);
      let to = Number(range[2]);
      if (from > to) [from, to] = [to, from];
      for (let p = from; p <= to; p++) addPage(pages, p, numPages);
      continue;
    }
    if (/^\d+$/.test(token)) addPage(pages, Number(token), numPages);
  }
  return [...pages].sort((a, b) => a - b);
}

function addPage(set: Set<number>, page: number, numPages: number): void {
  if (Number.isInteger(page) && page >= 1 && page <= numPages) set.add(page);
}
