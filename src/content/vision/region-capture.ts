/**
 * 2.4: выбор произвольной области рамкой. Полноэкранный overlay над вьюпортом;
 * пользователь тянет прямоугольник. На mouseup overlay убирается, вызывается
 * переданный capture (снимок видимой области), результат кропится к выбранной
 * области с учётом devicePixelRatio. Esc / нулевая рамка → null (отмена).
 *
 * DOM-модуль → без юнит-тестов (миграция §6).
 */

const OVERLAY_ID = "tne-region-overlay";

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось декодировать снимок."));
    image.src = src;
  });
}

/** Кропит data URL снимка к области в CSS-координатах вьюпорта. */
async function cropToRect(dataUrl: string, rect: Rect): Promise<string> {
  const image = await loadImage(dataUrl);
  // Снимок снят в физических пикселях (innerWidth * dpr). Масштабируем CSS → пиксели снимка.
  const scale = image.naturalWidth / window.innerWidth || 1;
  const sx = Math.max(0, Math.round(rect.left * scale));
  const sy = Math.max(0, Math.round(rect.top * scale));
  const sw = Math.max(1, Math.round(rect.width * scale));
  const sh = Math.max(1, Math.round(rect.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен для кропа.");
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Показывает overlay, ждёт рамку. Возвращает CSS-rect или null (отмена). */
function selectRect(): Promise<Rect | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    const box = document.createElement("div");
    box.className = "tne-region-box";
    box.style.display = "none";
    overlay.appendChild(box);
    document.documentElement.appendChild(overlay);

    let startX = 0;
    let startY = 0;
    let dragging = false;

    const cleanup = (): void => {
      window.removeEventListener("keydown", onKey, true);
      overlay.remove();
    };
    const finish = (rect: Rect | null): void => {
      cleanup();
      resolve(rect);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(null);
      }
    };

    overlay.addEventListener("mousedown", (e) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      box.style.display = "block";
      box.style.left = `${startX}px`;
      box.style.top = `${startY}px`;
      box.style.width = "0px";
      box.style.height = "0px";
    });
    overlay.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const left = Math.min(startX, e.clientX);
      const top = Math.min(startY, e.clientY);
      box.style.left = `${left}px`;
      box.style.top = `${top}px`;
      box.style.width = `${Math.abs(e.clientX - startX)}px`;
      box.style.height = `${Math.abs(e.clientY - startY)}px`;
    });
    overlay.addEventListener("mouseup", (e) => {
      if (!dragging) return finish(null);
      dragging = false;
      const left = Math.min(startX, e.clientX);
      const top = Math.min(startY, e.clientY);
      const width = Math.abs(e.clientX - startX);
      const height = Math.abs(e.clientY - startY);
      if (width < 6 || height < 6) return finish(null);
      finish({ left, top, width, height });
    });
    window.addEventListener("keydown", onKey, true);
  });
}

/**
 * Полный флоу 2.4: выбрать рамку → снять вкладку (через capture) → кроп.
 * `capture` отвечает за скрытие панели и снимок (см. attachments.captureTabDataUrl).
 */
export async function captureRegion(capture: () => Promise<string>): Promise<string | null> {
  const rect = await selectRect();
  if (!rect) return null;
  const dataUrl = await capture();
  return cropToRect(dataUrl, rect);
}
