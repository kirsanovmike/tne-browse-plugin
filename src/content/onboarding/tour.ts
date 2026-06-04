/**
 * PHASE 8: spotlight-движок. Чистая nextVisibleIndex() покрыта Vitest; DOM-часть
 * (startTour/closeTour) добавляется ниже и проверяется вручную.
 */

/**
 * Следующий видимый индекс шага в направлении step (+1/-1), начиная с from+step.
 * isVisible(i) — есть ли у шага i видимый якорь. Возвращает -1, если такого нет.
 */
export function nextVisibleIndex(
  total: number,
  from: number,
  step: 1 | -1,
  isVisible: (i: number) => boolean,
): number {
  for (let i = from + step; i >= 0 && i < total; i += step) {
    if (isVisible(i)) return i;
  }
  return -1;
}
