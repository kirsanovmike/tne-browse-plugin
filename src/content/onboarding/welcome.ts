/**
 * PHASE 8: приветственная карусель (3 слайда). Последний слайд запускает тур.
 * Любое завершение карусели помечает онбординг виденным (markSeen).
 */
import { STATE } from "../state";
import { ONBOARDING_ICONS } from "./icons";
import { ensureOnboardingStyles } from "./styles";
import { markSeen } from "./state";
import { startTour } from "./tour";

interface Slide { icon: string; title: string; body: string; }

const SLIDES: Slide[] = [
  { icon: "doc", title: "Я читаю открытую страницу",
    body: "Беру содержимое текущей вкладки и отвечаю строго по нему. Спросите о чём угодно на этой странице." },
  { icon: "spark", title: "Не только вопросы",
    body: "Команды и готовые промпты, скриншоты и снимок области, таблицы в Excel, PDF и документы, перевод." },
  { icon: "compass", title: "Покажу, где что лежит",
    body: "За минуту проведу по основным кнопкам. Запустить заново можно кнопкой «?» в шапке." },
];

let overlay: HTMLElement | null = null;
let current = 0;

function close(): void {
  overlay?.remove();
  overlay = null;
  void markSeen();
}

function renderSlide(): void {
  if (!overlay) return;
  const s = SLIDES[current];
  if (!s) return;
  const last = current === SLIDES.length - 1;
  const dots = SLIDES.map((_, i) => `<i class="${i === current ? "is-on" : ""}"></i>`).join("");
  overlay.innerHTML = `
    <div class="tne-onb-card" role="dialog" aria-label="Знакомство с ТНЭ чат">
      <div class="tne-onb-hero"><div class="tne-onb-badge">${ONBOARDING_ICONS[s.icon] ?? ""}</div></div>
      <div class="tne-onb-body"><h3></h3><p></p></div>
      <div class="tne-onb-nav">
        <button class="tne-onb-skip" data-act="skip">${last ? "Не сейчас" : "Пропустить"}</button>
        <div class="tne-onb-dots">${dots}</div>
        <button class="tne-onb-next" data-act="next">${last ? "Провести →" : "Далее"}</button>
      </div>
    </div>`;
  (overlay.querySelector("h3") as HTMLElement).textContent = s.title;
  (overlay.querySelector("p") as HTMLElement).textContent = s.body;
}

/** Открывает карусель приветствия (с нулевого слайда). */
export function startWelcome(): void {
  const r = STATE.panel;
  if (!r || overlay) return;
  ensureOnboardingStyles();
  current = 0;

  overlay = document.createElement("div");
  overlay.className = "tne-onb-overlay";
  overlay.addEventListener("click", (e) => {
    const act = (e.target as HTMLElement).closest("[data-act]")?.getAttribute("data-act");
    if (act === "skip") { close(); return; }
    if (act === "next") {
      if (current === SLIDES.length - 1) {
        overlay?.remove(); overlay = null; // не markSeen дважды — startTour сам пометит
        startTour();
      } else {
        current += 1;
        renderSlide();
      }
    }
  });
  r.appendChild(overlay);
  renderSlide();
}
