/**
 * PHASE 8: состояние онбординга в `storage.local` (ключ `tneOnboarding`).
 * Чистые функции (shouldAutoStart / isHintSeen / withHintSeen) покрыты Vitest;
 * read/write/mark* — тонкие обёртки над storage, проверяются вручную.
 */
import { browser } from "../../shared/browser";

export const ONBOARDING_VERSION = 1;
const STORAGE_KEY = "tneOnboarding";

export interface OnboardingState {
  seenVersion: number | null;
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

/** Видена ли подсказка 💡 с данным id. */
export function isHintSeen(state: OnboardingState, id: string): boolean {
  return state.hintsSeen.includes(id);
}

/** Вернуть новое состояние с добавленным id (без дублей, без мутации). */
export function withHintSeen(state: OnboardingState, id: string): OnboardingState {
  if (state.hintsSeen.includes(id)) return state;
  return { ...state, hintsSeen: [...state.hintsSeen, id] };
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

/** Отметить подсказку 💡 виденной. */
export async function markHintSeen(id: string): Promise<void> {
  const state = await readOnboarding();
  await writeOnboarding(withHintSeen(state, id));
}
