/**
 * PHASE 8: данные spotlight-тура. Чистый модуль (Vitest). Порядок и формулировки
 * согласованы с владельцем (8 шагов). anchor — CSS-селектор(ы) в shadow root
 * панели; массив = группа (подсвечиваются вместе). icon — ключ ONBOARDING_ICONS.
 */
export type Placement = "top" | "bottom" | "auto";

export interface TourStep {
  id: string;
  anchor: string | string[];
  icon: string;
  title: string;
  body: string; // допускается <b> для акцентов
  placement: Placement;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "context",
    anchor: ".tne-context-card",
    icon: "doc",
    title: "Контекст страницы",
    body: "Панель сама берёт текст страницы. <b>Вся страница</b> — отвечаю по ней. <b>Без контекста</b> — обычный вопрос к модели, страницу не смотрю.",
    placement: "bottom",
  },
  {
    id: "font",
    anchor: "#tne-font-menu-wrap",
    icon: "text",
    title: "Размер текста",
    body: "Делает шрифт в панели крупнее или мельче — удобно для длинных ответов.",
    placement: "bottom",
  },
  {
    id: "export",
    anchor: "#tne-chat-export",
    icon: "download",
    title: "Скачать диалог",
    body: "Сохраняет всю переписку в файл .md — переслать коллеге или подшить к задаче.",
    placement: "bottom",
  },
  {
    id: "clear",
    anchor: "#tne-chat-clear",
    icon: "erase",
    title: "Очистить чат",
    body: "Стирает текущую переписку и начинает с чистого листа. Контекст соберётся заново.",
    placement: "bottom",
  },
  {
    id: "settings",
    anchor: "#tne-chat-settings",
    icon: "gear",
    title: "Настройки",
    body: "Технические параметры подключения. Обычно настроены админом — сюда лезть не нужно.",
    placement: "bottom",
  },
  {
    id: "attach",
    anchor: ["#tne-attach-screen", "#tne-attach-region", "#tne-attach-file"],
    icon: "camera",
    title: "Скриншот, область, файл",
    body: "Снимок видимой части, снимок области рамкой или вложение картинки / PDF. Модель «увидит» изображение.",
    placement: "top",
  },
  {
    id: "tables",
    anchor: "#tne-tables-export",
    icon: "table",
    title: "Таблицы → Excel",
    body: "Выгружает таблицы с текущей страницы в файл Excel одним нажатием.",
    placement: "top",
  },
  {
    id: "prompts",
    anchor: "#tne-quick-actions",
    icon: "cmd",
    title: "Команды и готовые промпты",
    body: "Чипы — частые запросы в один клик (можно добавлять свои). А в поле ввода наберите <b>/</b> — появятся /summary, /table, /translate и другие.",
    placement: "top",
  },
];
