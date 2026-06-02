/**
 * Единый источник правды настроек расширения (дизайн §3): убирает дублирование
 * дефолтов между `options.js`, `content.js`, `background.js`.
 *
 * Чистые функции (дефолты, coerce формы, парсинг списка доменов) покрыты Vitest;
 * `readSettings`/`writeSettings` — тонкая обёртка над `storage.local`.
 */

import { browser } from "./browser";

export interface Settings {
  endpoint: string;
  visionEndpoint: string;
  token: string;
  authHeaderName: string;
  authPrefix: string;
  model: string;
  modelId: number;
  mode: string;
  temperature: number;
  maxOutputTokens: number;
  maxContextChars: number;
  requestTimeoutMs: number;
  maxRetries: number;
  panelFontSize: number;
  allowExternal: boolean;
  autoScreenshot: boolean;
  whitelist: string[];
  denylist: string[];
}

/** Жёсткий потолок длины контекста (см. CLAUDE.md / дизайн §1). */
export const MAX_CONTEXT_HARD_LIMIT = 25000;

export const DEFAULT_SETTINGS: Settings = {
  endpoint: "https://llm-prod.tne.tn.corp:13600/api/v1/chat/generate",
  visionEndpoint: "",
  token: "",
  authHeaderName: "Authorization",
  authPrefix: "Bearer ",
  model: "qwen-main",
  modelId: 5,
  mode: "llm",
  temperature: 0.01,
  maxOutputTokens: 16394,
  maxContextChars: 20000,
  requestTimeoutMs: 90000,
  maxRetries: 1,
  panelFontSize: 12,
  allowExternal: false,
  autoScreenshot: false,
  whitelist: ["*.tn.corp", "*.transneftenergo.ru"],
  denylist: [],
};

/** Поля, которые сохраняет форма модели на странице настроек. */
export type ModelSettings = Pick<
  Settings,
  | "endpoint"
  | "visionEndpoint"
  | "token"
  | "authHeaderName"
  | "authPrefix"
  | "model"
  | "modelId"
  | "mode"
  | "temperature"
  | "maxOutputTokens"
  | "maxContextChars"
  | "requestTimeoutMs"
  | "maxRetries"
>;

type RawInput = Record<string, string | null | undefined>;

/**
 * Приводит сырые значения формы к типизированным настройкам модели.
 * Поведение один-в-один с прежним обработчиком submit в `options.js`
 * (включая клампы maxContextChars и maxRetries).
 */
export function coerceModelSettings(input: RawInput): ModelSettings {
  return {
    endpoint: String(input.endpoint || "").trim(),
    visionEndpoint: String(input.visionEndpoint || "").trim(),
    token: String(input.token || "").trim(),
    authHeaderName: String(input.authHeaderName || "Authorization").trim(),
    authPrefix: String(input.authPrefix ?? "Bearer "),
    model: String(input.model || "qwen-main").trim(),
    modelId: Number(input.modelId || 5),
    mode: "llm",
    temperature: Number(input.temperature || 0.01),
    maxOutputTokens: Number(input.maxOutputTokens || 16394),
    maxContextChars: Math.min(Number(input.maxContextChars || 20000), MAX_CONTEXT_HARD_LIMIT),
    requestTimeoutMs: Number(input.requestTimeoutMs || 90000),
    maxRetries: Math.max(0, Number(input.maxRetries || 0)),
  };
}

/** Парсит textarea со списком доменов: по строке, trim, пустые отбрасываются. */
export function parseDomainList(value: string | null | undefined): string[] {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Читает настройки из storage.local, накладывая дефолты. */
export async function readSettings(): Promise<Settings> {
  const saved = await browser.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...(saved as Partial<Settings>) };
}

/** Сохраняет частичный набор настроек в storage.local. */
export async function writeSettings(partial: Partial<Settings>): Promise<void> {
  await browser.storage.local.set(partial);
}
