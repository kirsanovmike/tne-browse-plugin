/**
 * 5.6: перевод выделенного фрагмента «на месте» с откатом. Заменяет выделение на
 * span с переводом (оригинал — в data-tne-original; клик возвращает текст).
 * Span живёт в page DOM (вне shadow root) → только inline-стили. Ручная проверка (§6).
 */
import { readSettings } from "../../shared/settings";
import { isHostAllowed } from "../../shared/whitelist";
import { isInsideExtension } from "../dom-utils";
import { requestPlainAnswer } from "../chat/plain-request";
import { detectTargetLang } from "./lang-detect";
import { buildTranslatePrompt } from "./translate-prompt";

const MAX_LEN = 5000;
const MIN_LEN = 1;

/** Переводит текущее выделение прямо на странице (с возможностью отката кликом). */
export async function translateSelectionInPlace(): Promise<void> {
  const settings = await readSettings();
  if (!isHostAllowed(location.hostname || "", settings)) {
    toast("Расширение не активно на этом домене.");
    return;
  }

  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
    toast("Сначала выделите текст для перевода.");
    return;
  }
  const original = sel.toString().trim();
  if (original.length < MIN_LEN) {
    toast("Выделение пустое.");
    return;
  }
  if (original.length > MAX_LEN) {
    toast(`Слишком длинный фрагмент (>${MAX_LEN} символов). Выделите меньше.`);
    return;
  }

  const range = sel.getRangeAt(0).cloneRange();
  if (isInsideExtension(range.commonAncestorContainer as Node)) {
    toast("Это элемент расширения, не страница.");
    return;
  }

  const span = document.createElement("span");
  span.className = "tne-inplace-translating";
  span.textContent = "⏳ перевод…";
  span.style.cssText = "opacity:0.6;outline:1px dashed #0d9488;border-radius:3px;";
  try {
    range.deleteContents();
    range.insertNode(span);
  } catch {
    toast("Не удалось заменить выделение (сложная разметка). Используйте «Перевести» в чат.");
    return;
  }
  sel.removeAllRanges();

  const answer = await requestPlainAnswer(
    buildTranslatePrompt(original, detectTargetLang(original))
  );

  if (!answer.ok || !answer.content.trim()) {
    revertSpan(span, original);
    toast(answer.error || "Перевод не получен.");
    return;
  }

  showTranslated(span, original, answer.content.trim());
}

/** Заменяет span готовым переводом и навешивает клик-откат. */
function showTranslated(span: HTMLElement, original: string, translation: string): void {
  span.className = "tne-translated";
  span.textContent = translation;
  span.dataset.tneOriginal = original;
  span.title = "Кликните, чтобы вернуть оригинал";
  span.style.cssText =
    "border-bottom:1px dashed #0d9488;cursor:pointer;background:rgba(13,148,136,0.08);border-radius:2px;";
  span.addEventListener("click", () => revertSpan(span, original), { once: true });
}

/** Возвращает оригинальный текст на место span. */
function revertSpan(span: HTMLElement, original: string): void {
  const text = document.createTextNode(original);
  span.replaceWith(text);
}

/** Лёгкий страничный тост (панель может быть закрыта) — inline-стили, авто-скрытие. */
function toast(message: string): void {
  const el = document.createElement("div");
  el.textContent = message;
  el.style.cssText = [
    "position:fixed", "z-index:2147483647", "left:50%", "bottom:32px",
    "transform:translateX(-50%)", "max-width:80vw",
    "background:#161e2e", "color:#f2f5fa", "padding:10px 16px",
    "border:1px solid rgba(13,148,136,0.5)", "border-radius:10px",
    "box-shadow:0 10px 30px rgba(0,0,0,0.45)",
    "font-family:Inter,ui-sans-serif,system-ui,sans-serif", "font-size:13px",
  ].join(";");
  document.documentElement.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
