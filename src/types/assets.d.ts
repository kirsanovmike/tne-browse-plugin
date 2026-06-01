/**
 * Декларации для импорта ассетов через Vite-суффиксы.
 *
 * `?inline` (CSS → строка) используется для вставки `panel.css` и темы
 * highlight.js в shadow root (дизайн §4: уходим от web_accessible_resources для CSS).
 */
declare module "*.css?inline" {
  const css: string;
  export default css;
}

declare module "*?inline" {
  const content: string;
  export default content;
}
