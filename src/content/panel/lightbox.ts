/**
 * 5.R3-5: просмотр приложенного изображения в полном экране панели.
 * Lightbox-оверлей живёт в shadow root панели (поверх UI), закрывается по клику
 * по фону, кнопке-крестику или Esc; фокус возвращается на элемент-источник.
 *
 * DOM-модуль → без юнит-тестов (§6 стиля проекта).
 */
import { STATE } from "../state";

const LIGHTBOX_CLASS = "tne-lightbox";

/** Открывает изображение `src` на весь экран панели. */
export function openImageLightbox(src: string): void {
  const root = STATE.panel;
  if (!root || !src) return;

  closeLightbox(); // не плодим несколько оверлеев
  const previouslyFocused = (STATE.shadow?.activeElement as HTMLElement | null) ?? null;

  const overlay = document.createElement("div");
  overlay.className = LIGHTBOX_CLASS;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Просмотр изображения");

  const img = document.createElement("img");
  img.className = "tne-lightbox-img";
  img.src = src;
  img.alt = "приложенное изображение";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "tne-lightbox-close";
  close.setAttribute("aria-label", "Закрыть просмотр");
  close.textContent = "×";

  overlay.append(img, close);
  root.appendChild(overlay);

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
    }
  }

  // Клик по фону закрывает; по самому изображению — нет.
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeLightbox();
  });
  img.addEventListener("click", (event) => event.stopPropagation());
  close.addEventListener("click", () => closeLightbox());
  document.addEventListener("keydown", onKeydown, true);

  // Сохраняем обработчик/фокус на узле, чтобы снять их при закрытии.
  (overlay as unknown as { _tneCleanup: () => void })._tneCleanup = () => {
    document.removeEventListener("keydown", onKeydown, true);
    previouslyFocused?.focus?.();
  };

  close.focus();
}

/** Закрывает активный lightbox, если он есть. */
export function closeLightbox(): void {
  const overlay = STATE.panel?.querySelector<HTMLElement>(`.${LIGHTBOX_CLASS}`);
  if (!overlay) return;
  (overlay as unknown as { _tneCleanup?: () => void })._tneCleanup?.();
  overlay.remove();
}
