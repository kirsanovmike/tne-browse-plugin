/**
 * 4.1: распознавание меток-источников в тексте ответа модели и замена их на
 * кликабельные <span> в отрендеренном HTML.
 *
 * `findSourceLabels` — чистая (покрыта Vitest); `linkifySources` — DOM-обход
 * (без юнит-тестов, ручная проверка, §6 стиля проекта).
 */
import { STATE } from "../state";

/**
 * Распознаёт [FORM Fn]/[TABLE Tn]/[MODAL Mn]/[DOCUMENT Dn] и [SELECTED].
 * [PAGE] намеренно не распознаётся (5.R3-2): это метаданные (title/url/время),
 * их нельзя подсветить как DOM-элемент → остаются обычным текстом.
 * Замечание 1A: [MAIN CONTENT] исключён — основной текст больше не ссылочный
 * блок (модель плодила бесполезные кликабельные «[MAIN CONTENT]»-цитаты).
 */
const LABEL_SOURCE = "\\[(FORM|TABLE|MODAL|DOCUMENT)\\s+([A-Z]\\d+)\\]|\\[(SELECTED)\\]";

export interface SourceLabel {
  index: number;
  length: number;
  label: string;
  blockId: string;
}

/** Возвращает все метки-источники в тексте с позициями и распарсенным blockId. */
export function findSourceLabels(text: string): SourceLabel[] {
  const value = String(text || "");
  const re = new RegExp(LABEL_SOURCE, "g");
  const out: SourceLabel[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    const label = match[0];
    const blockId = match[2] ?? match[3] ?? label;
    out.push({ index: match.index, length: label.length, label, blockId });
  }
  return out;
}

/** Заменяет метки-источники в text-нодах target на кликабельные span (пропуская pre/code). */
export function linkifySources(target: HTMLElement): void {
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest("pre, code, .tne-source-link")) return NodeFilter.FILTER_REJECT;
      return findSourceLabels(node.nodeValue || "").length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const nodes: Text[] = [];
  let current: Node | null;
  while ((current = walker.nextNode()) !== null) nodes.push(current as Text);
  nodes.forEach(replaceInTextNode);
}

/** Блок локализуем (5.R3-2): есть живой DOM-элемент в blockMap на момент рендера. */
function isBlockLocatable(blockId: string): boolean {
  const el = STATE.blockMap[blockId];
  return !!(el && el instanceof Element && el.isConnected);
}

function replaceInTextNode(textNode: Text): void {
  const text = textNode.nodeValue || "";
  const labels = findSourceLabels(text);
  // Кликабельными делаем только метки, у которых есть что подсветить, — иначе
  // оставляем обычным текстом (нет «мёртвых» ссылок и тостов «не найден»).
  if (!labels.some((item) => isBlockLocatable(item.blockId))) return;

  const fragment = document.createDocumentFragment();
  let last = 0;
  for (const item of labels) {
    if (item.index > last) fragment.appendChild(document.createTextNode(text.slice(last, item.index)));
    if (isBlockLocatable(item.blockId)) {
      const span = document.createElement("span");
      span.className = "tne-source-link";
      span.setAttribute("data-block-id", item.blockId);
      span.setAttribute("role", "button");
      span.setAttribute("tabindex", "0");
      span.textContent = item.label;
      fragment.appendChild(span);
    } else {
      fragment.appendChild(document.createTextNode(item.label));
    }
    last = item.index + item.length;
  }
  if (last < text.length) fragment.appendChild(document.createTextNode(text.slice(last)));
  textNode.parentNode?.replaceChild(fragment, textNode);
}
