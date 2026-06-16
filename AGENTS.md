# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

**ТНЭ чат** is a Firefox browser extension (Manifest V2) that injects a chat sidebar panel into any page, extracts DOM content as context, and sends user questions to a corporate LLM endpoint. Designed for a closed corporate network.

- No build system, no bundler, no TypeScript — vanilla JavaScript loaded directly by Firefox
- Version: `0.8.0-firefox`
- Third-party libraries are **vendored locally** under `lib/` (Mozilla Readability, marked, highlight.js) — never loaded from a CDN, per the closed-network requirement

## Loading the Extension

No build step is needed. To load into Firefox:

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json` from the project root

After editing any JS/CSS file, click **Reload** on the extension card in `about:debugging`. Content scripts reload on the next page navigation; background script reloads immediately.

There are no tests, no lint commands, and no package.json.

## Architecture

### Three runtime contexts

| File | Firefox context | Role |
|------|----------------|------|
| `background.js` | Background script (non-persistent) | Handles `browserAction` click, builds and sends HTTP requests to the LLM, injects content script |
| `content.js` | Content script (injected into every page) | All UI: sidebar panel, chat, context extraction, DOM watching |
| `options.js` + `options.html` | Options page (tab) | Settings form — reads/writes `browser.storage.local` |

### Message flow

1. User clicks toolbar button → `background.js` receives `browserAction.onClicked`
2. Background tries to message an existing panel; on first use it injects the vendored `lib/*.js` scripts followed by `content.js` (no page-level `insertCSS` — styles live in the shadow root)
3. `content.js` creates the sidebar panel **inside a Shadow DOM** and renders chat UI
4. On user submit: `content.js` sends `{type: "TNE_ASK_MODEL", requestId, payload}` to `background.js`
5. `background.js` builds a Russian-language structured prompt and POSTs to the configured LLM endpoint, with timeout, retries-with-backoff, and abort support
6. Response is extracted from one of several supported JSON shapes and returned to `content.js`, which renders it as sanitized Markdown

Other background message types: `TNE_BUILD_PAYLOAD` (token-free payload preview), `TNE_ABORT` (stop a request), `TNE_DIAG_PING` (connection test), `TNE_GET_DIAG` (last payload/error), `TNE_OPEN_OPTIONS`.

### Shadow DOM panel

The panel host `#tne-page-chat-host` lives in the page DOM; the actual UI is built inside its open shadow root, where `#tne-page-chat-root` is styled by `panel.css` (loaded via `<link>` from `web_accessible_resources`). Because shadow content is outside the document tree, the panel is automatically excluded from context extraction.

### Context extraction (content.js)

The most complex part of the codebase. On panel open and before each request (only if `contextDirty`), `content.js` builds a **structured** representation with ID-tagged blocks: `[PAGE] [SELECTED] [MODAL Mn] [FORM Fn] [TABLE Tn] [HEADINGS] [MAIN CONTENT] [VISIBLE TEXT] [INTERFACE]`.

- Uses vendored Mozilla **Readability** for `[MAIN CONTENT]`, with a heuristic fallback
- Tables → Markdown; forms → `label: value` with password/token/secret-like values masked; visible modals captured
- `STATE.blockMap` maps block IDs → DOM elements (for future source highlighting)
- A **scope** switch (whole page / visible / selection / tables) changes which blocks are collected
- Trims by priority when over `maxContextChars` (default 20 000, hard cap 25 000): selection > modal > forms > tables > visible text > headings > main content > rest
- Before sending, scans the context for card numbers (Luhn), JWTs, and key-like strings and warns the user
- Watches SPA navigation (patched `history` methods, `popstate`/`hashchange`, 800 ms poll) and re-attaches the host if the page removes it
- `MutationObserver` only marks context "dirty"; it never re-parses on each mutation

### Settings (`browser.storage.local`)

All configurable via the options page:

| Key | Default |
|-----|---------|
| `endpoint` | `https://llm-prod.tne.tn.corp:13600/api/v1/chat/generate` |
| `token` | (empty) |
| `authHeaderName` | `Authorization` |
| `authPrefix` | `Bearer ` |
| `model` | `qwen-main` |
| `modelId` | `5` |
| `temperature` | `0.01` |
| `maxOutputTokens` | `16394` |
| `maxContextChars` | `20000` (hard cap 25000) |
| `requestTimeoutMs` | `90000` |
| `maxRetries` | `1` |
| `visionEndpoint` | (empty, Phase 2) |
| `allowExternal` | `false` |
| `whitelist` | `["*.tn.corp", "*.transneftenergo.ru"]` |
| `denylist` | `[]` |

### Styling

`panel.css` is injected as a web-accessible resource. All panel elements use the `tne-` CSS class prefix and CSS variables (`--tne-background`, `--tne-primary`, `--tne-error`, etc.) to avoid collisions with host-page styles. The panel has `z-index: 2147483647` and slides in from the right at `clamp(400px, 32vw, 600px)` width.

## Planned but Not Yet Implemented

See `docs/step by step.md` for the full roadmap and `PROGRESS.md` for the work log. Phase 1 `P0` (1.1–1.12) is implemented. Still unimplemented:
- **Phase 1 `P1`** (1.13 SPA-keeper polish, 1.14 iframe/open-shadow traversal, 1.15 hotkeys/UX base)
- **Vision / screenshot API** (Phase 2)
- **PDF support via PDF.js** (Phase 3)
- **Source-block highlight on click** (Phase 4 — `STATE.blockMap` is already populated)
- **Local token encryption via WebCrypto AES-GCM** (Phase 6)
