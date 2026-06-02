import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { getManifest, type TargetBrowser } from "./manifest.config";

// M5: целевой браузер выбирается переменной окружения TARGET_BROWSER
// (firefox | chrome); по умолчанию — firefox. Сборка пишется в dist/<browser>.
// Скрипты build:firefox / build:chrome задают её; `npm run build` гоняет оба.
const target: TargetBrowser =
  process.env.TARGET_BROWSER === "chrome" ? "chrome" : "firefox";

export default defineConfig(({ mode }) => ({
  // Сборка пишется в dist/<browser>; .gitignore уже игнорирует dist/.
  build: {
    outDir: `dist/${target}`,
    emptyOutDir: true,
  },
  plugins: [
    webExtension({
      manifest: () => getManifest({ browser: target, mode }),
      browser: target,
      // content-скрипт инжектится динамически (его нет в манифесте) — объявляем
      // его entry дополнительным входом, чтобы Vite собрал его в единый IIFE.
      // M3: entry — src/content/index.ts; libs (readability/marked/highlight.js)
      // из npm бандлятся внутрь, CSS инлайнится через ?inline. Вывод:
      // dist/firefox/src/content/index.js (см. injector.ts).
      additionalInputs: ["src/content/index.ts"],
      // M0 строит артефакт; авто-запуск Firefox через web-ext не нужен.
      disableAutoLaunch: true,
    }),
    // Статические рантайм-ассеты, которые плагин НЕ собирает сам:
    //  • icons/* — манифест и content (getURL "icons/icon128.png") ждут их
    //    в каталоге icons/ (плагин кладёт в корень только для options.html).
    // M3: lib/*.js и lib/highlight-theme.css больше не копируем (libs из npm,
    // тема highlight.js инлайнится); panel.css не копируем (инлайнится в shadow).
    // options.js не копируем с M1 (логика — src/options/options.ts, бандлит Vite).
    viteStaticCopy({
      targets: [
        { src: "icons/*", dest: "icons" },
        // PDF.js worker: грузится через runtime.getURL("pdf.worker.min.mjs"),
        // объявлен в web_accessible_resources. Стабильное имя без хеша → WAR-матч.
        { src: "node_modules/pdfjs-dist/build/pdf.worker.min.mjs", dest: "." },
      ],
    }),
  ],
}));
