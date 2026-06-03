/**
 * Чистое имя файла экспорта таблицы: tne-table-<slug>-<N>-<YYYY-MM-DD-HHMM>.xlsx.
 * По образцу buildExportFilename из chat/export-md.ts. Phase 5 (5.3). Vitest.
 */
export function buildTableFilename(title: string | undefined, index: number, date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;

  const slug = String(title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return slug ? `tne-table-${slug}-${index}-${stamp}.xlsx` : `tne-table-${index}-${stamp}.xlsx`;
}
