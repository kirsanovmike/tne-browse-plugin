/**
 * 4.6: пресеты системной роли ассистента. Чистый модуль (Vitest). Активная роль
 * хранится в settings.roleId; background применяет её через buildPrompt.
 */

export interface RolePreset {
  id: string;
  label: string;
  /** Добавка к системному промпту; для «Базового» — пустая (текущее поведение). */
  systemPrompt: string;
}

export const ROLE_PRESETS: readonly RolePreset[] = [
  { id: "general", label: "Базовый", systemPrompt: "" },
  {
    id: "analyst",
    label: "Аналитик",
    systemPrompt:
      "Действуй как аналитик: опирайся на факты, цифры и формулировки из контекста, выделяй ключевые выводы и структурируй ответ.",
  },
  {
    id: "support",
    label: "Поддержка",
    systemPrompt:
      "Действуй как специалист поддержки: дружелюбный тон, пошаговые понятные инструкции для пользователя, без лишнего жаргона.",
  },
  {
    id: "developer",
    label: "Разработчик",
    systemPrompt:
      "Действуй как разработчик: технически точно, с терминами и примерами кода, где это уместно; не упрощай в ущерб корректности.",
  },
  {
    id: "compliance",
    label: "Комплаенс",
    systemPrompt:
      "Действуй как специалист по комплаенсу: обращай внимание на риски, требования, сроки и соответствие; формулируй аккуратно и осторожно.",
  },
];

export const DEFAULT_ROLE_ID = "general";

/** Добавка к системному промпту по id роли; неизвестный/пустой id → "". */
export function resolveRolePrompt(roleId: string | undefined): string {
  const preset = ROLE_PRESETS.find((r) => r.id === roleId);
  return preset ? preset.systemPrompt : "";
}
