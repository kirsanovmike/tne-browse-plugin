/**
 * PHASE 8: одноразовые контекстные подсказки 💡 для функций вне тура
 * (роль, тема, обновление контекста). По одной за раз, не во время тура/карусели.
 */
import { STATE } from "../state";
import { ONBOARDING_ICONS } from "./icons";
import { ensureOnboardingStyles } from "./styles";
import { readOnboarding, markHintSeen, isHintSeen } from "./state";

interface HintDef { id: string; anchor: string; text: string; }

const HINTS: HintDef[] = [
  { id: "role", anchor: "#tne-role-select", text: "Здесь меняется роль ассистента — тон и фокус ответов." },
  { id: "theme", anchor: "#tne-theme-toggle", text: "Переключить светлую/тёмную тему панели." },
  { id: "refresh", anchor: "#tne-refresh-context", text: "Пересобрать контекст, если страница изменилась." },
];

let active: HTMLElement | null = null;

function showHint(def: HintDef): void {
  const r = STATE.panel;
  if (!r || active) return;
  const anchor = r.querySelector(def.anchor) as HTMLElement | null;
  if (!anchor || anchor.offsetParent === null) return;
  ensureOnboardingStyles();

  const base = r.getBoundingClientRect();
  const b = anchor.getBoundingClientRect();
  const bubble = document.createElement("div");
  bubble.className = "tne-onb-hint";
  bubble.innerHTML = `<button class="tne-onb-hint-close" aria-label="Понятно">${ONBOARDING_ICONS.close}</button><span></span>`;
  (bubble.querySelector("span") as HTMLElement).textContent = def.text;
  bubble.style.top = `${b.bottom - base.top + 8}px`;
  bubble.style.left = `${Math.max(12, Math.min(b.left - base.left, base.width - 232))}px`;

  const dismiss = () => { bubble.remove(); active = null; void markHintSeen(def.id); };
  bubble.querySelector(".tne-onb-hint-close")?.addEventListener("click", dismiss);
  anchor.addEventListener("click", dismiss, { once: true });

  r.appendChild(bubble);
  active = bubble;
}

/**
 * Инициализирует показ подсказок: при первом наведении на элемент показывает его
 * подсказку, если она ещё не видена. Срабатывает не во время активного оверлея.
 */
export async function initHints(): Promise<void> {
  const r = STATE.panel;
  if (!r) return;
  const state = await readOnboarding();
  for (const def of HINTS) {
    if (isHintSeen(state, def.id)) continue;
    const anchor = r.querySelector(def.anchor) as HTMLElement | null;
    if (!anchor) continue;
    anchor.addEventListener("mouseenter", () => {
      // не мешаем карусели/туру: они вешают оверлей .tne-onb-overlay / .tne-onb-tip
      if (r.querySelector(".tne-onb-overlay, .tne-onb-tip")) return;
      void readOnboarding().then((s) => { if (!isHintSeen(s, def.id)) showHint(def); });
    }, { once: true });
  }
}
