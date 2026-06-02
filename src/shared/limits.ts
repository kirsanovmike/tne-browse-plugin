/**
 * Единый источник правды числовых лимитов Phase 2 (Vision), §3 плана.
 * Это константы кода, а не пользовательские настройки. Исключение — автоскриншот:
 * он по задаче 2.5 обязан быть UI-чекбоксом (см. settings.autoScreenshot).
 */

/** Максимум изображений в одном запросе (контракт api doc). */
export const MAX_IMAGES = 5;

/** Ресайз изображения по большей стороне, px. */
export const IMAGE_MAX_SIDE = 1600;

/** Качество JPEG при сжатии (0..1). */
export const IMAGE_QUALITY = 0.8;

/** Таймаут запроса с изображениями, мс (vision дольше текста). */
export const VISION_TIMEOUT_MS = 120000;

/** Минимальный интервал между захватами экрана, мс (= ≤2 вызова/сек). */
export const CAPTURE_MIN_INTERVAL_MS = 500;

/** Масштаб рендера страницы PDF в canvas (затем compressDataUrl ужимает до IMAGE_MAX_SIDE). */
export const PDF_RENDER_SCALE = 2.0;

/** Порог эвристики «скан»: меньше символов на страницу → считаем бедным текстовым слоем. */
export const PDF_SCAN_MIN_CHARS_PER_PAGE = 100;

/** Дефолт «первые N страниц» при загрузке PDF. */
export const PDF_DEFAULT_PAGES = 5;
