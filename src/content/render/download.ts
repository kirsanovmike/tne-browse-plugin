/**
 * Скачивание Blob через временную <a download> + objectURL. DOM-обвязка,
 * без юнит-тестов (§6). Общая для экспорта диалога (.md) и таблиц (.xlsx).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
