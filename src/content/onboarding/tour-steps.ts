/**
 * PHASE 8: данные spotlight-тура. Чистый модуль (Vitest). Порядок и формулировки
 * согласованы с владельцем. anchor — CSS-селектор(ы) в shadow root панели;
 * массив = группа (подсвечиваются вместе). icon — ключ ONBOARDING_ICONS.
 *
 * body допускает <b> для акцентов, <br> и переносы строк \n — для разбиения
 * на короткие строки/маркеры (см. sanitizeBody в tour.ts).
 */
export type Placement = "top" | "bottom" | "auto";

export interface TourStep {
  id: string;
  anchor: string | string[];
  icon: string;
  title: string;
  body: string;
  placement: Placement;
  /**
   * Якорь шага живёт в выпадающем меню настроек (`#tne-settings-menu`) и не виден,
   * пока меню закрыто. Тур открывает меню перед подсветкой такого шага и закрывает
   * его на шагах, которым меню не нужно (см. tour.ts, доработки п. 5).
   */
  requiresMenu?: boolean;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "context",
    anchor: ".tne-context-card",
    icon: "doc",
    title: "Контекст страницы",
    body: "Панель сама берёт текст открытой страницы.\n<b>Вся страница</b> — отвечаю по её содержимому.\n<b>Без контекста</b> — обычный вопрос к модели, страницу не смотрю.",
    placement: "bottom",
  },
  {
    id: "role",
    anchor: "#tne-role-select",
    icon: "role",
    title: "Собеседник",
    body: "Выберите, в какой роли отвечать — меняется тон и фокус:\n• Аналитик — выводы и цифры\n• Поддержка — простые объяснения\n• Разработчик — код и детали\n• Юрист — формулировки и риски",
    placement: "bottom",
    requiresMenu: true,
  },
  {
    id: "font",
    anchor: "#tne-font-menu-wrap",
    icon: "text",
    title: "Размер текста",
    body: "Делает шрифт в панели крупнее или мельче.\nУдобно для длинных ответов.",
    placement: "bottom",
    requiresMenu: true,
  },
  {
    id: "theme",
    anchor: "#tne-theme-toggle",
    icon: "theme",
    title: "Тема оформления",
    body: "Переключает <b>светлую</b> и <b>тёмную</b> тему панели.\nНа оформление страницы не влияет.",
    placement: "bottom",
    requiresMenu: true,
  },
  {
    id: "export",
    anchor: "#tne-chat-export",
    icon: "download",
    title: "Скачать диалог",
    body: "Сохраняет всю переписку в файл .md.\nМожно переслать коллеге или подшить к задаче.",
    placement: "bottom",
    requiresMenu: true,
  },
  {
    id: "clear",
    anchor: "#tne-chat-clear",
    icon: "erase",
    title: "Очистить чат",
    body: "Стирает текущую переписку и начинает с чистого листа.\nКонтекст соберётся заново.",
    placement: "bottom",
    requiresMenu: true,
  },
  {
    id: "attach",
    anchor: ["#tne-attach-screen", "#tne-attach-region", "#tne-attach-file"],
    icon: "camera",
    title: "Скриншот, область, файл",
    body: "Покажите модели изображение:\n• снимок видимой части\n• снимок области рамкой\n• вложение картинки или PDF",
    placement: "top",
  },
  {
    id: "tables",
    anchor: "#tne-tables-export",
    icon: "table",
    title: "Таблицы → Excel",
    body: "Выгружает таблицы с текущей страницы в файл Excel.\nОдним нажатием.",
    placement: "top",
  },
  {
    id: "prompts",
    anchor: "#tne-quick-actions",
    icon: "cmd",
    title: "Команды и готовые промпты",
    body: "Готовые промпты — частые запросы в один клик (можно добавлять свои).\nВ поле ввода наберите <b>/</b> — появятся /summary, /table, /translate и другие.",
    placement: "top",
  },
];
