/**
 * 5.4: чистая часть заполнения форм — текстовый манифест полей для модели и
 * сборка «plain»-промпта, который просит вернуть ТОЛЬКО JSON {fieldId: значение}.
 * Без DOM → покрыто Vitest.
 */

/** Минимальная форма поля, нужная для манифеста (подмножество FillableField). */
export interface ManifestField {
  fieldId: string;
  type: string;
  label: string;
  options?: string[];
}

/** Текстовый список полей: «field1 | Тип: text | Метка: "ФИО" [| Варианты: …]». */
export function buildFieldManifest(fields: ManifestField[]): string {
  return fields
    .map((f) => {
      const parts = [`${f.fieldId}`, `Тип: ${f.type}`, `Метка: "${f.label || "без метки"}"`];
      if (f.options && f.options.length) {
        parts.push(`Варианты: [${f.options.map((o) => `"${o}"`).join(", ")}]`);
      }
      return parts.join(" | ");
    })
    .join("\n");
}

/** «Plain»-промпт: вернуть JSON-объект значений только для заполнимых полей. */
export function buildFillPrompt(description: string, fields: ManifestField[]): string {
  return [
    "Ты помогаешь заполнить веб-форму. Ниже — список её полей (с идентификаторами) и описание данных от пользователя.",
    "Верни ТОЛЬКО JSON-объект вида {\"fieldId\": \"значение\"} — для тех полей, значение которых однозначно следует из описания.",
    "Для полей с вариантами (select/radio/checkbox) выбирай ровно один из предложенных вариантов дословно.",
    "Не добавляй поля, которых нет в списке. Не выдумывай данные, отсутствующие в описании.",
    "Без markdown, без пояснений и без какого-либо текста вне JSON.",
    "",
    "# Поля формы",
    buildFieldManifest(fields),
    "",
    "# Описание пользователя",
    description.trim() || "(пусто)",
  ].join("\n");
}
