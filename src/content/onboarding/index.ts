/**
 * PHASE 8: публичный фасад онбординга для панели. Ре-экспорты + авто-показ.
 */
import { readOnboarding, shouldAutoStart } from "./state";
import { startWelcome } from "./welcome";

export { ensureOnboardingStyles } from "./styles";
export { startWelcome } from "./welcome";
export { startTour, closeTour } from "./tour";

/** Авто-показ карусели при первом открытии панели (по флагу). */
export async function maybeStartOnboarding(): Promise<void> {
  const state = await readOnboarding();
  if (shouldAutoStart(state)) startWelcome();
}
