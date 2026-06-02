/**
 * Сжатие и кодирование изображений для Vision (Phase 2). Работает в content —
 * у него есть DOM/canvas в обоих браузерах (в Chromium SW их нет). Canvas
 * создаётся detached и не попадает ни в страницу, ни в сбор контекста.
 *
 * Чистые хелперы (`computeScaledSize`, `dataUrlToBase64`) покрыты Vitest;
 * canvas/DOM-функции — ручная проверка (миграция §6).
 */
import { IMAGE_MAX_SIDE, IMAGE_QUALITY } from "../../shared/limits";

export interface Size {
  width: number;
  height: number;
}

/** Масштаб по большей стороне до max, без апскейла. Округляет до целых. */
export function computeScaledSize(width: number, height: number, max: number): Size {
  const longest = Math.max(width, height);
  if (longest === 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / longest);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Срезает префикс `data:...;base64,` → чистый base64 (контракт api doc). */
export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.includes(",") ? dataUrl.split(",")[1] ?? "" : dataUrl;
}

export interface CompressedImage {
  dataUrl: string; // сжатый jpeg data URL (для превью)
  base64: string; // чистый base64 (для отправки)
  bytes: number; // примерный размер base64 в байтах
}

export interface CompressOptions {
  maxSide?: number;
  quality?: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось декодировать изображение."));
    image.src = src;
  });
}

/** Сжимает data URL: ресайз по большей стороне → jpeg. */
export async function compressDataUrl(
  dataUrl: string,
  options: CompressOptions = {}
): Promise<CompressedImage> {
  const maxSide = options.maxSide ?? IMAGE_MAX_SIDE;
  const quality = options.quality ?? IMAGE_QUALITY;

  const image = await loadImage(dataUrl);
  const { width, height } = computeScaledSize(image.naturalWidth, image.naturalHeight, maxSide);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен для сжатия изображения.");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const out = canvas.toDataURL("image/jpeg", quality);
  const base64 = dataUrlToBase64(out);
  return { dataUrl: out, base64, bytes: Math.round((base64.length * 3) / 4) };
}

/** Читает выбранный файл изображения → data URL. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.readAsDataURL(file);
  });
}
