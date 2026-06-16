/**
 * SPA-keeper (Phase 1.13): следит за сменой URL без перезагрузки, возвращает
 * удалённый страницей хост, переподключает MutationObserver к новому <body>, и
 * помечает контекст «грязным» при значимых мутациях (не парсит на каждую).
 *
 * Перенесено из `content.js` на M3. DOM → без юнит-тестов (дизайн §6).
 */
import { STATE, TNE_HOST_ID, OBSERVER_OPTIONS } from "./state";
import { isInsideExtension, isReadableElement, toElement } from "./dom-utils";
import { normalizeText, isUsefulText } from "../shared/text";
import { refreshContext, updateContextMeta } from "./context/refresh";

const ATTR_FILTER = ["value", "placeholder", "title", "aria-label", "aria-labelledby", "class", "style", "hidden", "aria-hidden"];

type HistoryMethod = "pushState" | "replaceState";
type PatchableFn = ((...args: unknown[]) => unknown) & { __tnePatched?: boolean };

export function startUrlWatcher(): void {
  if (STATE.urlWatchStarted) return;
  STATE.urlWatchStarted = true;

  const refreshIfUrlChanged = (): void => {
    if (location.href === STATE.lastUrl) return;
    STATE.lastUrl = location.href;
    STATE.page = null;
    markContextDirty();
    if (STATE.opened) scheduleContextRefresh("url-change");
  };

  const patchHistoryMethod = (name: HistoryMethod): void => {
    const original = history[name] as unknown as PatchableFn;
    if (typeof original !== "function" || original.__tnePatched) return;
    const patched = function patchedHistoryMethod(this: History, ...args: unknown[]): unknown {
      const result = original.apply(this, args);
      window.setTimeout(refreshIfUrlChanged, 0);
      return result;
    } as PatchableFn;
    patched.__tnePatched = true;
    (history as unknown as Record<HistoryMethod, PatchableFn>)[name] = patched;
  };

  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");
  window.addEventListener("popstate", refreshIfUrlChanged);
  window.addEventListener("hashchange", refreshIfUrlChanged);

  // Тик SPA-keeper'а: вернуть удалённый хост, переподключить observer к новому
  // <body>, отследить смену URL даже без событий history.
  window.setInterval(() => {
    ensureHostAttached();
    reobserveIfBodyReplaced();
    refreshIfUrlChanged();
  }, 800);
}

/** Если страница выкинула наш хост из DOM — возвращаем его на место. */
export function ensureHostAttached(): boolean {
  if (!STATE.shadow) return false;
  const host = STATE.shadow.host;
  if (!host) return false;
  if (host.isConnected && document.getElementById(TNE_HOST_ID)) return false;
  (document.documentElement || document.body)?.appendChild(host);
  markContextDirty();
  return true;
}

/** Если SPA заменила весь <body>, переподключаем observer к актуальному body. */
function reobserveIfBodyReplaced(): void {
  if (!STATE.domObserver) return;
  const target = document.body || document.documentElement;
  if (!target || target === STATE.observedTarget) return;
  try {
    STATE.domObserver.disconnect();
  } catch {
    /* observer уже отключён */
  }
  STATE.observedTarget = target;
  STATE.domObserver.observe(target, OBSERVER_OPTIONS);
  markContextDirty();
}

export function markContextDirty(): void {
  STATE.contextDirty = true;
  updateContextMeta();
}

export function scheduleContextRefresh(reason: string, delayMs = 300): void {
  markContextDirty();
  window.clearTimeout(STATE.refreshTimer);

  const elapsed = Date.now() - STATE.lastContextRefreshAt;
  const throttleDelay = reason === "dom-change" && elapsed < 1400 ? 1400 - elapsed : 0;
  const delay = Math.max(delayMs, throttleDelay);

  STATE.refreshTimer = window.setTimeout(() => {
    if (!STATE.opened) return;
    refreshContext(false, reason);
  }, delay);
}

export function startDomWatcher(): void {
  if (STATE.domWatchStarted) return;
  const target = document.body || document.documentElement;
  if (!target || typeof MutationObserver === "undefined") return;

  STATE.domWatchStarted = true;

  // Доработки п. 4: кнопку «Обновить» убрали — контекст пересобирается сам.
  // Наблюдатель/ввод не парсят на каждую мутацию, а планируют дебаунс-пересбор;
  // тяжёлый разбор троттлится (reason "dom-change" → не чаще раза в 1400 мс) и не
  // запускается во время отправки. Так мета честно держится «свежей».
  const markDirty = (): void => {
    if (!STATE.opened || STATE.isSending) return;
    scheduleContextRefresh("dom-change", 900);
  };

  const isMeaningfulMutation = (mutation: MutationRecord): boolean => {
    if (isInsideExtension(mutation.target)) return false;

    if (mutation.type === "characterData") {
      const parent = mutation.target.parentElement;
      return Boolean(parent && isReadableElement(parent) && !isInsideExtension(parent));
    }

    if (mutation.type === "childList") {
      const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
      // Удаление root-панели страницей также должно помечать контекст dirty.
      if (nodes.some((node) => (node as Element).id === TNE_HOST_ID)) return true;
      return nodes.some((node) => {
        if (isInsideExtension(node)) return false;
        if (node.nodeType === Node.TEXT_NODE) return isUsefulText(normalizeText(node.nodeValue || ""));
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        const tag = (node as Element).tagName?.toLowerCase?.() || "";
        if (["script", "style", "noscript", "template", "svg", "canvas"].includes(tag)) return false;
        return true;
      });
    }

    if (mutation.type === "attributes") {
      const attr = mutation.attributeName || "";
      if (!ATTR_FILTER.includes(attr)) return false;
      const el = toElement(mutation.target);
      return Boolean(el && !isInsideExtension(el));
    }

    return false;
  };

  STATE.domObserver = new MutationObserver((mutations) => {
    // SPA-keeper: если страница удалила хост — возвращаем его.
    if (ensureHostAttached()) return;
    if (mutations.some(isMeaningfulMutation)) markDirty();
  });

  STATE.observedTarget = target;
  STATE.domObserver.observe(target, OBSERVER_OPTIONS);

  STATE.domInputHandler = (event: Event): void => {
    if (isInsideExtension(event.target as Node)) return;
    markDirty();
  };

  document.addEventListener("input", STATE.domInputHandler, true);
  document.addEventListener("change", STATE.domInputHandler, true);
}
