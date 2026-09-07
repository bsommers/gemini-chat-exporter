# Design Specification: Gemini Chat Exporter Modernization & Packaging

**Date:** 2026-09-05  
**Status:** Approved  
**Author:** Bill Sommers  

---

## 1. Overview & Goals

The **Gemini Chat Exporter** is a privacy-first Chrome Extension (Manifest V3) that extracts conversations from [gemini.google.com](https://gemini.google.com) and exports them into multiple document formats.

This specification addresses three primary objectives:
1. **Gemini Logic Modernization:** Bring DOM scraping in line with modern Gemini (handling 2024–2026 UI updates such as thinking/reasoning blocks, KaTeX math rendering, user-attached files/images, accurate title detection, and critical code-block / image-placeholder bugs).
2. **Exporter Quality & New Formats:** Add Markdown table support (GFM), fix DOCX aspect ratio and nested list bugs, and add a structured **JSON Export** and **Copy to Clipboard** feature.
3. **Packaging & Test Automation:** Implement an automated build/distribution script generating an isolated `dist/unpacked/` directory and `.zip` distribution archive, accompanied by a test suite under `tests/` using Node's native test runner and JSDOM.

---

## 2. Architecture & Design

### 2.1 Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Chrome Browser                                              │
│                                                             │
│  [ gemini.google.com ]                                      │
│   └── content.js (Idempotent DOM Scraper)                   │
│         │                                                   │
│         │ extractChat() message                             │
│         ▼                                                   │
│  [ Extension Popup UI (popup.html / popup.js) ]             │
│   ├── User Actions: Markdown, DOCX, HTML, ZIP, JSON, Copy   │
│   └── Exporters (Vanilla JS):                               │
│         ├── markdown.js (Turndown + GFM Tables + Math)      │
│         ├── docx_export.js (docx.js + Aspect Ratio + Lists) │
│         ├── html_single.js & html_linked.js (Sanitized)     │
│         └── json_export.js (Structured Schema)              │
│         │                                                   │
│         ├── chrome.downloads.download()                     │
│         └── navigator.clipboard.writeText()                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Development & Build System                                  │
│                                                             │
│  scripts/package.mjs ──▶ dist/unpacked/ (Clean extension)   │
│                      ──▶ dist/gemini-chat-exporter-v*.zip   │
│                                                             │
│  tests/              ──▶ node --test (Exporters, Parsers)   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Core Design Principles
- **Auditable & Zero-Bundler:** Maintain vanilla JavaScript source code without Webpack/Vite bundlers so source code on GitHub exactly matches the installed extension files.
- **Privacy & Local-Only:** Zero telemetry, no external server requests, credentials only used inline for session-bound images.
- **Resilience:** Handle variations and fallbacks for Gemini's evolving DOM elements.

---

## 3. Detailed Component Specifications

### 3.1 Content Script Modernization (`content.js`)

1. **Idempotent Injection Guard:**
   ```javascript
   if (window.__geminiExporterLoaded) return;
   window.__geminiExporterLoaded = true;
   ```
   Prevents duplicate event listeners when injected dynamically by `popup.js`.

2. **Accurate Title Extraction:**
   Priority fallback sequence:
   1. Active chat item in sidebar (`[data-test-id="conversation-title"]`, `.conversation.selected`, `.chat-history .selected-chat`).
   2. Main chat title/header element (`header .title`, `h1`).
   3. Fallback: First turn user prompt truncated to 50 characters.
   4. Fallback: Sanitized `document.title` (excluding "Gemini", "Google Gemini").
   5. Default: `"gemini-chat"`.

3. **Code Block Replacement (Bug Fix):**
   - Replace the buggy nested index iteration with direct iteration over code blocks in the cloned DOM tree:
     ```javascript
     const cloneCodeBlocks = Array.from(clone.querySelectorAll('code-block, pre'));
     for (const cb of cloneCodeBlocks) {
         // Extract clean pre/code, strip header buttons (copy, run)
     }
     ```
   - Extract code language from `data-language`, `lang`, or class `language-*`.

4. **Image Placeholder & Resolution (Bug Fix):**
   - Use custom data attributes (`data-exporter-id="image-X"`) rather than fragile relative `src` manipulation that gets converted to absolute URLs by the browser.
   - Run image extraction in parallel using `Promise.all` with a concurrency cap to eliminate download lag on multi-image chats.

5. **User Query Multi-Modal Extraction:**
   - In addition to `.query-text`, extract attached user images (`img.user-image`, `.image-preview img`) and document attachments, mapping them into the turns payload.

6. **Thinking / Reasoning Blocks:**
   - Detect Gemini thinking/reasoning blocks (`.thinking-process`, `<expandable-block>`, `<thought-box>`).
   - Flag thinking content cleanly in the structured payload (`turn.thought`) or wrap it in a standardized collapsible `<details class="gemini-thought">` container so exporters can render or omit it cleanly.

7. **KaTeX / Math Extraction:**
   - When encountering `.katex` or `<math-renderer>`, extract the raw LaTeX math from `<annotation encoding="application/x-tex">` or `data-tex` attributes.
   - Strip duplicate `.katex-mathml` and `.katex-html` DOM nodes to prevent duplicated formula text.

---

### 3.2 Exporters Upgrade (`exporters/`)

1. **Markdown (`exporters/markdown.js`):**
   - Integrate GFM table conversion rules (rendering Markdown tables with proper alignment delimiters `| --- | --- |`).
   - Support LaTeX math blocks: format inline math as `$formula$` and block math as `$$formula$$`.
   - Format thoughts as blockquotes or `<details><summary>Thought Process</summary>...</details>`.

2. **Word Document (`exporters/docx_export.js`):**
   - **Image Aspect Ratios:** Compute image dimensions dynamically based on natural dimensions or standard constraints (e.g. max width 550pt, scale height proportionally) instead of hardcoding `500x300`.
   - **Nested Lists:** Fix `node.querySelectorAll('li')` bug by traversing direct children only (`Array.from(node.children).filter(...)`), preserving indentation levels.
   - **Format support:** Convert WebP images to PNG/JPEG data buffers before passing to `docx` to avoid corrupting `.docx` files.

3. **HTML Exporters (`html_single.js` & `html_linked.js`):**
   - Use `data-exporter-id` replacement for 100% reliable placeholder substitution.
   - Add styles for math blocks, tables, and collapsible thought sections.

4. **New JSON Exporter (`exporters/json_export.js`):**
   - Generates clean, machine-readable JSON:
     ```json
     {
       "title": "Conversation Title",
       "exportedAt": "2026-09-05T17:45:00.000Z",
       "sourceUrl": "https://gemini.google.com/app/...",
       "turns": [
         {
           "role": "user",
           "text": "...",
           "attachments": []
         },
         {
           "role": "model",
           "thought": "...",
           "text": "...",
           "html": "..."
         }
       ]
     }
     ```

---

### 3.3 Popup UI Improvements (`popup.html`, `popup.js`, `popup.css`)

- Add **JSON (.json)** export button.
- Add **Copy Markdown** action button (copies formatted markdown to clipboard with a brief checkmark confirmation).
- Show chat turn count and image count in the popup status header.
- Provide real-time export progress feedback (e.g. "Processing turn 3 of 12...").

---

### 3.4 Cleanup & Manifest V3 Refactoring

- **`manifest.json`:**
  - Remove unnecessary `web_accessible_resources` exposure for `lib/*` and `exporters/*`.
  - Ensure permissions are strictly `activeTab`, `scripting`, `downloads`.
- **`background.js`:**
  - Remove dead `importScripts` and unused `export` listener. Keep a minimal service worker or streamline it.

---

### 3.5 Packaging & Distribution (`dist/` & `scripts/package.mjs`)

- Script: `scripts/package.mjs`
  - Validates `manifest.json`.
  - Creates clean `dist/unpacked/` containing only:
    - `manifest.json`
    - `content.js`
    - `popup.html`, `popup.css`, `popup.js`
    - `exporters/*.js`
    - `lib/*.js`
    - `icons/*.png`
  - Generates `dist/gemini-chat-exporter-v<version>.zip` ready for release and Chrome Web Store upload.
  - Excludes: `tests/`, `docs/`, `scripts/`, `README.md`, `LICENSE`, `DISCLAIMER.md`, `.git*`, `package*.json`.
- Add npm scripts to `package.json`:
  - `npm test`: Runs test suite.
  - `npm run build` / `npm run package`: Builds `dist/unpacked/` and zip.

---

### 3.6 Automated Test Suite (`tests/`)

- Tests run using Node 20 built-in test runner (`node --test`).
- Tests include:
  1. `tests/markdown.test.mjs`: Tests Markdown conversion for headings, fenced code blocks with language, GFM tables, math notation, and thinking sections.
  2. `tests/json.test.mjs`: Tests JSON exporter schema, turn order, and data integrity.
  3. `tests/html.test.mjs`: Tests single and linked HTML placeholder replacement and styling.
  4. `tests/docx.test.mjs`: Tests Word document generator, image run handling, and list hierarchy.
  5. `tests/dom_helpers.test.mjs`: Tests DOM sanitation, KaTeX LaTeX extraction, and title fallbacks.

---

## 4. Verification & Quality Gates

- `npm test` must pass with 100% green assertions.
- `npm run build` must cleanly produce:
  - `dist/unpacked/manifest.json`
  - `dist/gemini-chat-exporter-v1.0.0.zip`
- Smoke test `dist/unpacked/` by loading unpacked in a Chromium browser.
