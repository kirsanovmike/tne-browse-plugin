/**
 * PHASE 8: spotlight-движок. Чистая nextVisibleIndex() покрыта Vitest; DOM-часть
 * (startTour/closeTour) добавляется ниже и проверяется вручную.
 */
import { STATE } from "../state";
import { TOUR_STEPS } from "./tour-steps";
import { ONBOARDING_ICONS } from "./icons";
import { ensureOnboardingStyles } from "./styles";
import { markSeen } from "./state";

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
  cutout: HTMLElement;
  tip: HTMLElement;
  onKey: (e: KeyboardEvent) => void;
  onResize: () => void;
}

let session: TourSession | null = null;

function root(): HTMLElement | null {
  return STATE.panel ?? null;
}

/** Видимые DOM-якоря шага (учитывает группу-массив). Пустой массив = шаг скрыт. */
function anchorsOf(index: number): HTMLElement[] {
  const r = root();
  const step = TOUR_STEPS[index];
  if (!r || !step) return [];
  const sels = Array.isArray(step.anchor) ? step.anchor : [step.anchor];
  return sels
    .map((s) => r.querySelector(s) as HTMLElement | null)
    .filter((el): el is HTMLElement => !!el && el.offsetParent !== null);
}

function isVisible(index: number): boolean {
  return anchorsOf(index).length > 0;
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
  const els = anchorsOf(index);
  const step = TOUR_STEPS[index];
  if (!r || !step || els.length === 0) return;
  els[0]?.scrollIntoView({ block: "nearest" });

  const pad = 6;
  const rect = unionRect(els);
  const { cutout, tip } = session;
  cutout.style.top = `${rect.top - pad}px`;
  cutout.style.left = `${rect.left - pad}px`;
  cutout.style.width = `${rect.width + pad * 2}px`;
  cutout.style.height = `${rect.height + pad * 2}px`;

  const last = nextVisibleIndex(TOUR_STEPS.length, index, +1, isVisible) === -1;
  const first = nextVisibleIndex(TOUR_STEPS.length, index, -1, isVisible) === -1;
  const segs = TOUR_STEPS.map((_, i) => `<i class="${i === index ? "is-on" : ""}"></i>`).join("");
  tip.innerHTML = `
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
  // title/body — через textContent/ограниченный innerHTML (body допускает <b>).
  (tip.querySelector("h4") as HTMLElement).textContent = step.title;
  (tip.querySelector("p") as HTMLElement).innerHTML = sanitizeBody(step.body);

  // позиционирование карточки: над/под якорем по placement и по месту
  const rRect = r.getBoundingClientRect();
  const below = step.placement === "bottom"
    || (step.placement === "auto" && rect.top - pad < rRect.height / 2);
  tip.style.left = "12px";
  if (below) {
    tip.style.top = `${rect.top + rect.height + pad + 8}px`;
    tip.style.bottom = "";
  } else {
    tip.style.top = "";
    tip.style.bottom = `${rRect.height - (rect.top - pad) + 8}px`;
  }
  session.index = index;
}

/** Разрешаем только теги <b>; всё прочее экранируем. */
function sanitizeBody(body: string): string {
  const escaped = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(/&lt;b&gt;/g, "<b>").replace(/&lt;\/b&gt;/g, "</b>");
}

function go(direction: 1 | -1): void {
  if (!session) return;
  const next = nextVisibleIndex(TOUR_STEPS.length, session.index, direction, isVisible);
  if (next === -1) {
    if (direction === 1) closeTour(); // дальше нет видимых — финал
    return;
  }
  render(next);
}

export function closeTour(): void {
  if (!session) return;
  const r = root();
  session.cutout.remove();
  session.tip.remove();
  window.removeEventListener("resize", session.onResize);
  r?.removeEventListener("keydown", session.onKey as EventListener);
  session = null;
  void markSeen();
}

/** Запускает spotlight-тур с первого видимого шага. */
export function startTour(): void {
  const r = root();
  if (!r || session) return;
  ensureOnboardingStyles();

  const first = isVisible(0) ? 0 : nextVisibleIndex(TOUR_STEPS.length, 0, +1, isVisible);
  if (first === -1) return; // нечего показывать

  const cutout = document.createElement("div");
  cutout.className = "tne-onb-cutout";
  const tip = document.createElement("div");
  tip.className = "tne-onb-tip";
  tip.setAttribute("role", "dialog");

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); closeTour(); }
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

  r.appendChild(cutout);
  r.appendChild(tip);
  r.addEventListener("keydown", onKey as EventListener);
  window.addEventListener("resize", onResize);

  session = { index: first, cutout, tip, onKey, onResize };
  render(first);
}
