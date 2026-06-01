/**
 * Рендер ответа модели как безопасного Markdown (дизайн §3; Phase 1.12).
 * `marked` + `highlight.js` теперь из npm, бандлятся Vite локально (без CDN).
 * Санитайзер работает на инертном `<template>` (скрипты не выполняются).
 *
 * Перенесено из `content.js` (renderMarkdownInto / attachCodeCopyButton /
 * sanitizeToFragment / copyToClipboard) на M3. DOM → без юнит-тестов (дизайн §6).
 */
import { marked } from "marked";
import hljs from "highlight.js";
import { escapeHtml } from "../../shared/text";

/** Парсит Markdown, санитайзит, вставляет в target, подсвечивает код. */
export function renderMarkdownInto(target: HTMLElement, text: string): void {
  const raw = String(text || "");
  let html: string;
  try {
    html = marked.parse(raw, { gfm: true, breaks: true, async: false });
  } catch {
    html = `<p>${escapeHtml(raw).replace(/\n/g, "<br>")}</p>`;
  }

  const fragment = sanitizeToFragment(html);
  target.innerHTML = "";
  target.appendChild(fragment);

  target.querySelectorAll<HTMLElement>("pre code").forEach((block) => {
    try {
      hljs.highlightElement(block);
    } catch {
      /* подсветка опциональна */
    }
    attachCodeCopyButton(block);
  });

  target.querySelectorAll("a[href]").forEach((a) => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });
}

function attachCodeCopyButton(codeBlock: HTMLElement): void {
  const pre = codeBlock.closest("pre");
  if (!pre || pre.querySelector(".tne-code-copy")) return;
  pre.classList.add("tne-code-pre");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tne-code-copy";
  button.textContent = "Копировать код";
  button.addEventListener("click", async () => {
    await copyToClipboard(codeBlock.innerText);
    button.textContent = "Скопировано";
    setTimeout(() => (button.textContent = "Копировать код"), 1200);
  });
  pre.appendChild(button);
}

/** Санитайзер: template.content инертен (скрипты не выполняются, ресурсы не грузятся). */
function sanitizeToFragment(html: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  const dangerous = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT"]);

  template.content.querySelectorAll("*").forEach((el) => {
    if (dangerous.has(el.tagName)) {
      el.remove();
      return;
    }
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const val = String(attr.value || "");
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if (name === "style") el.removeAttribute(attr.name);
      else if ((name === "href" || name === "src" || name === "xlink:href") && /^\s*javascript:/i.test(val)) el.removeAttribute(attr.name);
    });
  });

  return template.content;
}

/** Копирует текст в буфер обмена с фолбэком на execCommand. */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {
      /* фолбэк не сработал */
    }
    ta.remove();
  }
}
