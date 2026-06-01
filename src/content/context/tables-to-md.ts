/**
 * Форматирование таблицы в Markdown (дизайн §3, §7 M3).
 *
 * Чистая часть: матрица ячеек (уже нормализованных и с экранированными `|`) →
 * Markdown-таблица. DOM-извлечение строк/ячеек живёт в `collectors.ts`.
 * Перенесено из `content.js` (tableToMarkdown) без изменения поведения → Vitest.
 */

/** Матрица ячеек (строки × колонки) → Markdown-таблица. "" если колонок нет. */
export function matrixToMarkdown(matrix: string[][]): string {
  if (!matrix.length) return "";

  const cols = Math.max(...matrix.map((r) => r.length));
  if (!cols) return "";

  const pad = (row: string[]): string => {
    const filled = [...row];
    while (filled.length < cols) filled.push("");
    return `| ${filled.join(" | ")} |`;
  };

  const header = pad(matrix[0]!);
  const separator = `| ${Array(cols).fill("---").join(" | ")} |`;
  const bodyRows = matrix.slice(1).map(pad);
  return [header, separator, ...bodyRows].join("\n");
}
