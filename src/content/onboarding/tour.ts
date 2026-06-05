/**
 * PHASE 8: spotlight-движок. Чистая nextVisibleIndex() покрыта Vitest; DOM-часть
 * (startTour/closeTour) добавляется ниже и проверяется вручную.
 */
import { STATE } from "../state";
import { TOUR_STEPS } from "./tour-steps";
import { ONBOARDING_ICONS } from "./icons";
import { ensureOnboardingStyles } from "./styles";
import { markSeen } from "./state";
import { openSettingsMenu, closeSettingsMenu, setSettingsMenuLock } from "../panel/settings-menu";

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

interface TourSession {
  index: number;
  dim: HTMLElement; // слой затемнения (клипует вырез по форме панели)
  cutout: HTMLElement;
  tip: HTMLElement;
  onKey: (e: KeyboardEvent) => void;
  onResize: () => void;
}

/** Отступ .tne-chat-panel от краёв root (margin:12px в panel.css). */
const PANEL_MARGIN = 12;
/** Минимальный зазор карточки-подсказки от краёв панели. */
const TIP_EDGE = 16;

let session: TourSession | null = null;

function root(): HTMLElement | null {
  return STATE.panel ?? null;
}

/** DOM-якоря шага (учитывает группу-массив), существующие в дереве панели. */
function anchorElements(index: number): HTMLElement[] {
  const r = root();
  const step = TOUR_STEPS[index];
  if (!r || !step) return [];
  const sels = Array.isArray(step.anchor) ? step.anchor : [step.anchor];
  return sels
    .map((s) => r.querySelector(s) as HTMLElement | null)
    .filter((el): el is HTMLElement => !!el);
}

/** Реально отрисованные якоря (offsetParent !== null) — для измерения рамки. */
function visibleAnchors(index: number): HTMLElement[] {
  return anchorElements(index).filter((el) => el.offsetParent !== null);
}

/** Якоря для измерения: видимые, а для шагов меню — существующие (меню открыто). */
function anchorsForRender(index: number): HTMLElement[] {
  const vis = visibleAnchors(index);
  if (vis.length > 0) return vis;
  return TOUR_STEPS[index]?.requiresMenu ? anchorElements(index) : [];
}

function isVisible(index: number): boolean {
  const step = TOUR_STEPS[index];
  if (!step) return false;
  // Шаг с якорем в меню считаем «видимым»: тур сам откроет меню перед показом (п. 5).
  if (step.requiresMenu) return anchorElements(index).length > 0;
  return visibleAnchors(index).length > 0;
}

/** Объединённый прямоугольник якорей относительно root (с учётом скролла root). */
function unionRect(els: HTMLElement[]): { top: number; left: number; width: number; height: number } {
  const r = root()!;
  const base = r.getBoundingClientRect();
  let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
  for (const el of els) {
    const b = el.getBoundingClientRect();
    top = Math.min(top, b.top); left = Math.min(left, b.left);
    right = Math.max(right, b.right); bottom = Math.max(bottom, b.bottom);
  }
  return { top: top - base.top, left: left - base.left, width: right - left, height: bottom - top };
}

function render(index: number): void {
  if (!session) return;
  const r = root();
  const els = anchorsForRender(index);
  const step = TOUR_STEPS[index];
  if (!r || !step || els.length === 0) return;
  els[0]?.scrollIntoView({ block: "nearest" });

  const pad = 6;
  const rRect = r.getBoundingClientRect();
  const innerW = rRect.width - PANEL_MARGIN * 2;
  const innerH = rRect.height - PANEL_MARGIN * 2;
  const rect = unionRect(els);
  const { cutout, tip } = session;

  // Координаты выреза — относительно слоя затемнения (inset:PANEL_MARGIN).
  // Клампим рамку по внутренним границам панели, чтобы не торчала (зад. 9).
  let cTop = rect.top - pad - PANEL_MARGIN;
  let cLeft = rect.left - pad - PANEL_MARGIN;
  let cW = rect.width + pad * 2;
  let cH = rect.height + pad * 2;
  if (cLeft < 0) { cW += cLeft; cLeft = 0; }
  if (cTop < 0) { cH += cTop; cTop = 0; }
  if (cLeft + cW > innerW) cW = innerW - cLeft;
  if (cTop + cH > innerH) cH = innerH - cTop;
  cutout.style.top = `${cTop}px`;
  cutout.style.left = `${cLeft}px`;
  cutout.style.width = `${Math.max(0, cW)}px`;
  cutout.style.height = `${Math.max(0, cH)}px`;

  const last = nextVisibleIndex(TOUR_STEPS.length, index, +1, isVisible) === -1;
  const first = nextVisibleIndex(TOUR_STEPS.length, index, -1, isVisible) === -1;
  const segs = TOUR_STEPS.map((_, i) => `<i class="${i === index ? "is-on" : ""}"></i>`).join("");
  tip.innerHTML = `
    <div class="tne-onb-arrow"></div>
    <div class="tne-onb-stepno">Шаг ${index + 1} из ${TOUR_STEPS.length}</div>
    <div class="tne-onb-ic">${ONBOARDING_ICONS[step.icon] ?? ""}</div>
    <h4></h4>
    <p></p>
    <div class="tne-onb-nav">
      ${first ? `<button class="tne-onb-skip" data-act="skip">Пропустить</button>`
              : `<button class="tne-onb-back" data-act="back">Назад</button>`}
      <div class="tne-onb-seg">${segs}</div>
      <button class="tne-onb-next" data-act="next">${last ? "Готово ✓" : "Далее"}</button>
    </div>`;
  // title/body — через textContent/ограниченный innerHTML (body допускает <b>, <br>).
  (tip.querySelector("h4") as HTMLElement).textContent = step.title;
  (tip.querySelector("p") as HTMLElement).innerHTML = sanitizeBody(step.body);

  // Позиционирование карточки: над/под якорем по placement, по горизонтали —
  // под своим элементом, но без прилипания к краям панели (зад. 4, 8).
  const below = step.placement === "bottom"
    || (step.placement === "auto" && rect.top - pad < rRect.height / 2);
  const tipW = tip.offsetWidth || 300;
  const left = Math.max(TIP_EDGE, Math.min(rect.left, rRect.width - tipW - TIP_EDGE));
  tip.style.left = `${left}px`;
  const gap = pad + 10;
  if (below) {
    tip.style.top = `${rect.top + rect.height + gap}px`;
    tip.style.bottom = "";
  } else {
    tip.style.top = "";
    tip.style.bottom = `${rRect.height - (rect.top - pad) + gap}px`;
  }

  // «Носик» от карточки к вырезу — указывает на текущий элемент (зад. 8).
  const arrow = tip.querySelector(".tne-onb-arrow") as HTMLElement;
  const center = rect.left + rect.width / 2 - left;
  arrow.style.left = `${Math.max(16, Math.min(center, tipW - 16))}px`;
  arrow.classList.toggle("is-up", below);
  arrow.classList.toggle("is-down", !below);
  session.index = index;
}

/** Разрешаем только <b> и <br>; переносы строк \n → <br>; всё прочее экранируем. */
function sanitizeBody(body: string): string {
  const escaped = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped
    .replace(/&lt;b&gt;/g, "<b>").replace(/&lt;\/b&gt;/g, "</b>")
    .replace(/&lt;br\s*\/?&gt;/g, "<br>")
    .replace(/\n/g, "<br>");
}

/**
 * Готовит «сцену» под шаг (п. 5): шагам с requiresMenu открывает меню настроек
 * и ставит замок (клик-вне/Esc его не схлопнут), остальным — закрывает.
 */
function prepareStage(index: number): void {
  if (TOUR_STEPS[index]?.requiresMenu) {
    setSettingsMenuLock(true);
    openSettingsMenu();
  } else {
    setSettingsMenuLock(false);
    closeSettingsMenu();
  }
}

/** Готовит сцену и на следующем кадре (после раскладки меню) рисует шаг. */
function showStep(index: number): void {
  if (!session) return;
  prepareStage(index);
  session.index = index; // фиксируем сразу, чтобы onResize рисовал верный шаг
  requestAnimationFrame(() => {
    if (session && session.index === index) render(index);
  });
}

function go(direction: 1 | -1): void {
  if (!session) return;
  const next = nextVisibleIndex(TOUR_STEPS.length, session.index, direction, isVisible);
  if (next === -1) {
    if (direction === 1) closeTour(); // дальше нет видимых — финал
    return;
  }
  showStep(next);
}

export function closeTour(): void {
  if (!session) return;
  const r = root();
  session.dim.remove(); // удаляет и вложенный cutout
  session.tip.remove();
  window.removeEventListener("resize", session.onResize);
  r?.removeEventListener("keydown", session.onKey as EventListener);
  session = null;
  // Снимаем замок и закрываем меню, которое мог открыть тур (п. 5).
  setSettingsMenuLock(false);
  closeSettingsMenu();
  void markSeen();
}

/** Запускает spotlight-тур с первого видимого шага. */
export function startTour(): void {
  const r = root();
  if (!r || session) return;
  ensureOnboardingStyles();

  const first = isVisible(0) ? 0 : nextVisibleIndex(TOUR_STEPS.length, 0, +1, isVisible);
  if (first === -1) return; // нечего показывать

  // Слой затемнения с overflow:hidden и формой панели — клипует вырез (зад. 1).
  const dim = document.createElement("div");
  dim.className = "tne-onb-dim";
  const cutout = document.createElement("div");
  cutout.className = "tne-onb-cutout";
  dim.appendChild(cutout);
  const tip = document.createElement("div");
  tip.className = "tne-onb-tip";
  tip.setAttribute("role", "dialog");

  const onKey = (e: KeyboardEvent) => {
    // stopPropagation: иначе Esc дойдёт до общего обработчика панели и закроет её
    // вслед за туром (п. 5 — Esc выходит из тура, панель остаётся).
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeTour(); }
    else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
  };
  const onResize = () => { if (session) render(session.index); };

  tip.addEventListener("click", (e) => {
    const act = (e.target as HTMLElement).closest("[data-act]")?.getAttribute("data-act");
    if (act === "next") go(1);
    else if (act === "back") go(-1);
    else if (act === "skip") closeTour();
  });

  r.appendChild(dim);
  r.appendChild(tip);
  r.addEventListener("keydown", onKey as EventListener);
  window.addEventListener("resize", onResize);

  session = { index: first, dim, cutout, tip, onKey, onResize };
  showStep(first);
}
