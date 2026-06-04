/**
 * 5.6 / доработка: перевод выделенного текста «на месте» с сохранением вёрстки.
 *
 * Раньше всё выделение заменялось одним span — при выделении большого фрагмента
 * (нескольких абзацев / всей страницы) разметка схлопывалась в один блок, картинки
 * «уезжали». Теперь:
 *   • выделение в пределах одного текстового узла → точечная замена (как прежде);
 *   • выделение по нескольким узлам → переводим КАЖДЫЙ текстовый узел отдельно и
 *     заменяем его инлайновым span'ом на своём месте. Структура DOM, картинки и
 *     блоки остаются нетронутыми — меняется только текст.
 * Перевод узлов уходит батчами одним запросом (нумерованные сегменты), чтобы не
 * слать сотни обращений. Откат — кликом по переведённому фрагменту или общей
 * кнопкой «Вернуть оригинал». Span живёт в page DOM → только inline-стили.
 * Ручная проверка (§6).
 */
import { readSettings } from "../../shared/settings";
import { isHostAllowed } from "../../shared/whitelist";
import { isInsideExtension } from "../dom-utils";
import { requestPlainAnswer } from "../chat/plain-request";
import { detectTargetLang, type TargetLang } from "./lang-detect";
import { buildTranslatePrompt } from "./translate-prompt";

const MAX_LEN = 40000;
const MIN_LEN = 1;
const MAX_NODES = 800;
const BATCH_SIZE = 25;

const TRANSLATED_CLASS = "tne-translated";
const TRANSLATED_STYLE =
  "border-bottom:1px dashed #0d9488;cursor:pointer;background:rgba(13,148,136,0.08);border-radius:2px;";
const PENDING_STYLE = "opacity:0.55;outline:1px dashed #0d9488;border-radius:3px;";

const LANG_NAME: Record<TargetLang, string> = { ru: "русский", en: "английский" };

/** Переводит текущее выделение прямо на странице (с возможностью отката). */
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
  if (isInsideExtension(range.commonAncestorContainer)) {
    toast("Это элемент расширения, не страница.");
    return;
  }

  const target = detectTargetLang(original);

  // Выделение целиком в одном текстовом узле → точечная замена выделенного куска.
  if (isSingleTextNodeSelection(range)) {
    sel.removeAllRanges();
    await translateSingleRange(range, original, target);
    return;
  }

  // Иначе — многоузловой режим: каждый текстовый узел переводится на своём месте.
  const nodes = collectTextNodes(range);
  sel.removeAllRanges();
  if (nodes.length === 0) {
    toast("Не нашёл текст для перевода в выделении.");
    return;
  }
  await translateNodesInPlace(nodes, target);
}

/** true, если всё выделение лежит внутри одного и того же текстового узла. */
function isSingleTextNodeSelection(range: Range): boolean {
  return (
    range.startContainer === range.endContainer &&
    range.startContainer.nodeType === Node.TEXT_NODE
  );
}

/** Старый путь: заменяет ровно выделенный фрагмент одним span'ом (инлайн, на месте). */
async function translateSingleRange(
  range: Range,
  original: string,
  target: TargetLang
): Promise<void> {
  const span = document.createElement("span");
  span.textContent = "⏳ перевод…";
  span.style.cssText = PENDING_STYLE;
  try {
    range.deleteContents();
    range.insertNode(span);
  } catch {
    toast("Не удалось заменить выделение (сложная разметка).");
    return;
  }

  const answer = await requestPlainAnswer(buildTranslatePrompt(original, target));
  if (!answer.ok || !answer.content.trim()) {
    revertSpan(span, original);
    toast(answer.error || "Перевод не получен.");
    return;
  }
  paintTranslated(span, original, answer.content.trim());
  ensureRevertAllButton();
}

interface NodeItem {
  node: Text;
  original: string;
  trimmed: string;
}

/** Многоузловой перевод: батчами, с заменой каждого текстового узла на месте. */
async function translateNodesInPlace(nodes: Text[], target: TargetLang): Promise<void> {
  const items: NodeItem[] = nodes.map((node) => {
    const original = node.nodeValue ?? "";
    return { node, original, trimmed: original.trim() };
  });

  toast(`Перевожу на ${LANG_NAME[target]} (${items.length} фрагм.)…`);

  let done = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const prompt = buildBatchPrompt(
      batch.map((b) => b.trimmed),
      target
    );
    const answer = await requestPlainAnswer(prompt);
    if (!answer.ok) {
      toast(answer.error || "Перевод прерван.");
      if (done > 0) ensureRevertAllButton();
      return;
    }
    const parts = parseNumbered(answer.content, batch.length);
    batch.forEach((item, idx) => {
      const translation = parts[idx]?.trim();
      // Пустой/недостающий сегмент — оставляем оригинал нетронутым.
      if (translation) {
        replaceNodeWithTranslation(item, translation);
        done += 1;
      }
    });
  }

  if (done === 0) {
    toast("Перевод не получен.");
    return;
  }
  ensureRevertAllButton();
  toast(`Готово: переведено фрагментов — ${done}.`);
}

/**
 * Собирает текстовые узлы, пересекающие выделение: непустые, вне script/style и
 * вне UI расширения; уже переведённые пропускаем. Узлы на границах выделения
 * переводятся целиком (для «выделить всё» это начало/конец — приемлемо).
 */
function collectTextNodes(range: Range): Text[] {
  const root = range.commonAncestorContainer;
  const walkRoot = (root.nodeType === Node.TEXT_NODE ? root.parentNode : root) as Node | null;
  if (!walkRoot) return [];

  const walker = document.createTreeWalker(walkRoot, NodeFilter.SHOW_TEXT, {
    acceptNode(node): number {
      const text = node as Text;
      if (!text.nodeValue || !text.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (!rangeIntersectsNode(range, text)) return NodeFilter.FILTER_REJECT;
      const parent = text.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
      if (isInsideExtension(text)) return NodeFilter.FILTER_REJECT;
      if (parent.closest?.(`.${TRANSLATED_CLASS}`)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const out: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode())) {
    out.push(current as Text);
    if (out.length >= MAX_NODES) break;
  }
  return out;
}

/** range.intersectsNode с фолбэком для сред, где метод недоступен. */
function rangeIntersectsNode(range: Range, node: Node): boolean {
  if (typeof range.intersectsNode === "function") return range.intersectsNode(node);
  const nodeRange = document.createRange();
  nodeRange.selectNode(node);
  return (
    range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0 &&
    range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0
  );
}

/** Заменяет текстовый узел инлайновым span'ом с переводом, сохраняя пробелы по краям. */
function replaceNodeWithTranslation(item: NodeItem, translation: string): void {
  const parent = item.node.parentNode;
  if (!parent) return;
  const lead = item.original.match(/^\s*/)?.[0] ?? "";
  const trail = item.original.match(/\s*$/)?.[0] ?? "";

  const span = document.createElement("span");
  span.textContent = `${lead}${translation}${trail}`;
  paintTranslated(span, item.original, undefined);
  try {
    parent.replaceChild(span, item.node);
  } catch {
    // Узел мог быть уже удалён динамикой страницы — молча пропускаем.
  }
}

/** Оформляет span как переведённый и навешивает клик-откат к оригиналу. */
function paintTranslated(span: HTMLElement, original: string, translation?: string): void {
  span.className = TRANSLATED_CLASS;
  if (translation !== undefined) span.textContent = translation;
  span.dataset.tneOriginal = original;
  span.title = "Кликните, чтобы вернуть оригинал";
  span.style.cssText = TRANSLATED_STYLE;
  span.addEventListener("click", () => revertSpan(span, original), { once: true });
}

/** Возвращает оригинальный текст на место span. */
function revertSpan(span: HTMLElement, original: string): void {
  span.replaceWith(document.createTextNode(original));
}

/** Возвращает оригинал во всех переведённых фрагментах на странице. */
function revertAll(): void {
  document.querySelectorAll<HTMLElement>(`.${TRANSLATED_CLASS}`).forEach((span) => {
    revertSpan(span, span.dataset.tneOriginal ?? span.textContent ?? "");
  });
  removeRevertAllButton();
}

// ── Нумерованный батч-промпт ────────────────────────────────────────────────

/** Промпт для батча: нумерованные сегменты, перевод вернуть с теми же маркерами. */
function buildBatchPrompt(segments: string[], target: TargetLang): string {
  const numbered = segments.map((seg, i) => `§${i + 1}§ ${seg}`).join("\n");
  return [
    `Переведи на ${LANG_NAME[target]} язык каждый фрагмент из списка ниже.`,
    "Каждый фрагмент начинается с маркера вида «§N§», где N — номер фрагмента.",
    "Сохрани ПОРЯДОК и КОЛИЧЕСТВО фрагментов. Верни только переводы, каждый со своим",
    "маркером «§N§» в начале, без пояснений, кавычек и markdown. Не объединяй фрагменты.",
    "",
    numbered,
  ].join("\n");
}

/**
 * Разбирает ответ модели по маркерам «§N§» в массив длины count. Совпадение по
 * номеру устойчиво к переносам строк и лишним пустым строкам; пропущенные номера
 * остаются пустыми (для них сохранится оригинал).
 */
export function parseNumbered(text: string, count: number): string[] {
  const result = new Array<string>(count).fill("");
  const re = /§\s*(\d+)\s*§/g;
  const matches = [...text.matchAll(re)];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const idx = Number(match[1]) - 1;
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? text.length) : text.length;
    if (idx >= 0 && idx < count) result[idx] = text.slice(start, end).trim();
  }
  return result;
}

// ── Кнопка «Вернуть оригинал» (общая) ───────────────────────────────────────

const REVERT_BTN_ID = "tne-translate-revert-all";

function ensureRevertAllButton(): void {
  if (document.getElementById(REVERT_BTN_ID)) return;
  const btn = document.createElement("button");
  btn.id = REVERT_BTN_ID;
  btn.type = "button";
  btn.textContent = "↩ Вернуть оригинал";
  btn.style.cssText = [
    "position:fixed", "z-index:2147483647", "right:20px", "bottom:20px",
    "background:#0d9488", "color:#f2f5fa", "border:none", "padding:10px 16px",
    "border-radius:10px", "cursor:pointer",
    "box-shadow:0 10px 30px rgba(0,0,0,0.45)",
    "font-family:Inter,ui-sans-serif,system-ui,sans-serif", "font-size:13px",
  ].join(";");
  btn.addEventListener("click", revertAll);
  document.documentElement.appendChild(btn);
}

function removeRevertAllButton(): void {
  document.getElementById(REVERT_BTN_ID)?.remove();
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
