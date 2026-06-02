/**
 * Вложения-изображения (Phase 2): состояние, лента превью, кнопки захвата/загрузки.
 * Сжатие — в image-compressor; привилегированный снимок — у background через
 * TNE_CAPTURE_TAB. DOM-модуль → без юнит-тестов (миграция §6).
 */
import { browser } from "../../shared/browser";
import { STATE, $, type Attachment } from "../state";
import { MAX_IMAGES } from "../../shared/limits";
import type { CaptureTabResponse } from "../../shared/messages";
import { compressDataUrl, fileToDataUrl } from "./image-compressor";
import { captureRegion } from "./region-capture";
import { addAssistantMessage } from "../panel/chat";

const TNE_HOST_ID = "tne-page-chat-host";

function makeId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Чистый base64 всех вложений — для отправки. */
export function attachmentImages(): string[] {
  return STATE.attachments.map((a) => a.base64);
}

export function clearAttachments(opts: { keepPdf?: boolean } = {}): void {
  STATE.attachments = opts.keepPdf ? STATE.attachments.filter((a) => a.source === "pdf") : [];
  renderAttachments();
}

function removeAttachment(id: string): void {
  STATE.attachments = STATE.attachments.filter((a) => a.id !== id);
  renderAttachments();
}

export function addAttachment(att: Attachment): boolean {
  if (STATE.attachments.length >= MAX_IMAGES) {
    addAssistantMessage(`Можно приложить не более ${MAX_IMAGES} изображений.`, { light: true });
    return false;
  }
  STATE.attachments.push(att);
  renderAttachments();
  return true;
}

/** Прячет хост панели/overlay, снимает вкладку через background, восстанавливает хост. */
async function captureTabDataUrl(): Promise<string> {
  const host = document.getElementById(TNE_HOST_ID);
  const prev = host?.style.visibility ?? "";
  if (host) host.style.visibility = "hidden";
  try {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const res = (await browser.runtime.sendMessage({ type: "TNE_CAPTURE_TAB" })) as
      | CaptureTabResponse
      | undefined;
    if (!res?.ok || !res.dataUrl) throw new Error(res?.error || "Не удалось снять экран.");
    return res.dataUrl;
  } finally {
    if (host) host.style.visibility = prev;
  }
}

/** 2.1 / 2.5: снимок видимой области → сжатие → вложение. Возвращает успех. */
export async function captureAndAttachScreen(): Promise<boolean> {
  try {
    const raw = await captureTabDataUrl();
    const img = await compressDataUrl(raw);
    return addAttachment({ id: makeId(), dataUrl: img.dataUrl, base64: img.base64, source: "screenshot", bytes: img.bytes });
  } catch (error) {
    addAssistantMessage(`Не удалось сделать скриншот: ${(error as Error)?.message || error}`, { light: true });
    return false;
  }
}

/** 2.4: область рамкой → снимок → кроп → сжатие → вложение. */
async function captureAndAttachRegion(): Promise<void> {
  try {
    const cropped = await captureRegion(captureTabDataUrl);
    if (!cropped) return; // отмена / нулевая рамка
    const img = await compressDataUrl(cropped);
    addAttachment({ id: makeId(), dataUrl: img.dataUrl, base64: img.base64, source: "region", bytes: img.bytes });
  } catch (error) {
    addAssistantMessage(`Не удалось снять область: ${(error as Error)?.message || error}`, { light: true });
  }
}

/** 2.3: загруженные файлы → сжатие → вложения. */
async function attachFromFiles(files: FileList | null): Promise<void> {
  if (!files) return;
  for (const file of Array.from(files)) {
    if (!file.type.startsWith("image/")) {
      addAssistantMessage(`Файл «${file.name}» не является изображением — пропущен.`, { light: true });
      continue;
    }
    if (STATE.attachments.length >= MAX_IMAGES) {
      addAssistantMessage(`Можно приложить не более ${MAX_IMAGES} изображений.`, { light: true });
      break;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      const img = await compressDataUrl(dataUrl);
      addAttachment({ id: makeId(), dataUrl: img.dataUrl, base64: img.base64, source: "upload", bytes: img.bytes, name: file.name });
    } catch (error) {
      addAssistantMessage(`Не удалось обработать «${file.name}»: ${(error as Error)?.message || error}`, { light: true });
    }
  }
}

/** Рендерит ленту превью под полем ввода. */
export function renderAttachments(): void {
  const bar = $("#tne-attachments");
  if (!bar) return;
  bar.innerHTML = "";
  bar.hidden = STATE.attachments.length === 0;
  for (const att of STATE.attachments) {
    const chip = document.createElement("div");
    chip.className = "tne-attachment";
    const kb = Math.max(1, Math.round(att.bytes / 1024));
    chip.innerHTML = `
      <img class="tne-attachment-thumb" src="${att.dataUrl}" alt="вложение" />
      <span class="tne-attachment-size">${kb} КБ</span>
      <button class="tne-attachment-remove" type="button" title="Убрать" aria-label="Убрать вложение">×</button>`;
    chip.querySelector(".tne-attachment-remove")?.addEventListener("click", () => removeAttachment(att.id));
    bar.appendChild(chip);
  }
}

/** Привязывает кнопки/инпут вложений в футере панели. */
export function initAttachments(root: HTMLElement): void {
  root.querySelector("#tne-attach-screen")?.addEventListener("click", () => void captureAndAttachScreen());
  root.querySelector("#tne-attach-region")?.addEventListener("click", () => void captureAndAttachRegion());

  const input = root.querySelector("#tne-attach-input") as HTMLInputElement | null;
  root.querySelector("#tne-attach-file")?.addEventListener("click", () => input?.click());
  input?.addEventListener("change", () => {
    void attachFromFiles(input.files).finally(() => {
      input.value = "";
    });
  });

  renderAttachments();
}
