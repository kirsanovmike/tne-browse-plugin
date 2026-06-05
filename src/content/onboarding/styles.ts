/**
 * PHASE 8: инъекция CSS онбординга в shadow root панели (по образцу panel.ts).
 * Отдельный модуль — чтобы tour/welcome/hints не импортировали из index.ts
 * (иначе цикл импортов).
 */
import onboardingCss from "./onboarding.css?inline";
import { STATE } from "../state";

const STYLE_ID = "tne-onboarding-style";

/** Один раз добавляет <style> онбординга в shadow root панели. */
export function ensureOnboardingStyles(): void {
  const shadow = STATE.shadow;
  if (!shadow || shadow.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = onboardingCss;
  shadow.appendChild(style);
}
