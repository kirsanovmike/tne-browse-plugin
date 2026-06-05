/**
 * PHASE 8: состояние онбординга в `storage.local` (ключ `tneOnboarding`).
 * Чистая функция shouldAutoStart покрыта Vitest; read/write/markSeen — тонкие
 * обёртки над storage, проверяются вручную.
 */
import { browser } from "../../shared/browser";

export const ONBOARDING_VERSION = 1;
const STORAGE_KEY = "tneOnboarding";

export interface OnboardingState {
  seenVersion: number | null;
  /** Устаревшее поле подсказок 💡 — больше не пишется, оставлено для совместимости. */
  hintsSeen: string[];
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  seenVersion: null,
  hintsSeen: [],
};

/** Показывать ли карусель автоматически (первый запуск). */
export function shouldAutoStart(state: OnboardingState): boolean {
  return state.seenVersion == null;
}

export async function readOnboarding(): Promise<OnboardingState> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const stored = raw[STORAGE_KEY] as Partial<OnboardingState> | undefined;
  return { ...DEFAULT_ONBOARDING_STATE, ...stored };
}

export async function writeOnboarding(state: OnboardingState): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: state });
}

/** Отметить онбординг виденным — авто-показа карусели больше не будет. */
export async function markSeen(): Promise<void> {
  const state = await readOnboarding();
  await writeOnboarding({ ...state, seenVersion: ONBOARDING_VERSION });
}
