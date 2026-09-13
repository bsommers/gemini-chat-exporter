# Gemini Chat Exporter: Modernization & Refactoring Plan

## 1. Executive Summary & Context

`gemini-chat-exporter` is a Chrome extension (Manifest V3) designed to export active chat conversations from Google Gemini (`https://gemini.google.com`) into multiple document formats:
- **Markdown (`.md`)**
- **Word Document (`.docx`)**
- **Single Webpage HTML (`.html`)** with embedded base64 assets
- **Webpage + Images ZIP (`.zip`)** with standalone HTML, CSS, and separate images folder
- **Structured JSON (`.json`)** for backup and data interchange (new)

The codebase was originally constructed ~4+ months ago as a flat, unbundled script collection. This modernization plan specifies how to:
1. Refactor into a clean modern modular architecture separating source (`src/`), clean production build output (`dist/`), and tests (`tests/`).
2. Add full compatibility with modern Gemini features (Deep Think / Thinking traces, Grounding citations, Python execution cells, LaTeX math, multimodal user attachments).
3. Integrate DOMPurify sanitization to eliminate HTML export XSS vulnerabilities.
4. Establish a full automated test suite (Vitest + JSDOM) covering scrapers with realistic DOM fixtures, exporter unit tests, security tests, and extension build packaging tests.
5. Provide complete developer and publishing documentation.

---

## 2. Current vs. Target Architecture Map

### 2.1 Current Architecture (Legacy)

```
gemini-chat-exporter/ (Root)
├── manifest.json              # Missing 'tabs' permission, unused web_accessible_resources
├── background.js              # Service worker containing broken DOM-dependent exporter code
├── content.js                 # Flat content script; lacks thinking, citations, math, multimodal
├── popup.html / css / js      # Popup executing exports in DOM context via <script> tags
├── exporters/                 # Global-scope scripts (markdown, docx_export, html_single, html_linked)
├── lib/ (gitignored)          # Missing vendor files (turndown, jszip, docx)
└── icons/                     # Extension icons
```

### 2.2 Target Modular Architecture

```
gemini-chat-exporter/
├── dist/                              # PRODUCTION EXTENSION (Unpacked load / CWS ZIP)
│   ├── manifest.json
│   ├── background.js                  # Lightweight MV3 service worker
│   ├── content.js                     # Bundled content scraper
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js                       # Bundled popup controller & exporters
│   └── icons/                         # Extension icons (16, 48, 128 px)
│
├── src/                               # SOURCE CODE (TypeScript / ESM)
│   ├── manifest.json                  # Source manifest template
│   ├── background/
│   │   └── index.ts                   # Clean lifecycle & context menu handler
│   ├── content/
│   │   ├── index.ts                   # Content script listener & injector
│   │   ├── extractor.ts               # Main conversation extractor orchestrator
│   │   ├── scrapers/
│   │   │   ├── userTurn.ts            # User prompts & multimodal file/image attachments
│   │   │   ├── modelTurn.ts           # Model response parser
│   │   │   ├── thoughtScraper.ts      # Thinking/Reasoning trace scraper
│   │   │   ├── mathScraper.ts         # LaTeX/KaTeX formula extractor
│   │   │   ├── codeScraper.ts         # Code blocks & Python execution cells
│   │   │   ├── citationScraper.ts     # Web grounding & source citations
│   │   │   └── imageScraper.ts        # Image downloader & base64 converter
│   │   └── types.ts                   # Data schemas (ChatData, Turn, Attachment, etc.)
│   ├── popup/
│   │   ├── popup.html                 # Modernized popup UI
│   │   ├── popup.css                  # Polished styling with light/dark theme support
│   │   └── popup.ts                   # Popup controller & download orchestrator
│   ├── exporters/
│   │   ├── markdown.ts                # Markdown exporter (GFM tables, math, thoughts)
│   │   ├── docx.ts                    # Word .docx exporter (bundled docx library)
│   │   ├── htmlSingle.ts              # Standalone HTML with theme toggle & sanitization
│   │   ├── htmlLinked.ts              # ZIP archive (HTML + CSS + separate images)
│   │   ├── json.ts                    # Structured JSON exporter
│   │   └── sanitizer.ts               # DOMPurify sanitization utility
│   └── icons/                         # PNG icons
│
├── tests/                             # COMPREHENSIVE AUTOMATED TEST SUITE
│   ├── unit/
│   │   ├── content/                   # Scraper unit tests
│   │   ├── exporters/                 # Exporter unit tests (MD, DOCX, HTML, ZIP, JSON)
│   │   ├── security/                  # DOMPurify & XSS prevention tests
│   │   └── popup/                     # Title detection & options tests
│   ├── fixtures/                      # Real Gemini DOM HTML snapshots
│   │   ├── basicChat.html
│   │   ├── thinkingProcess.html
│   │   ├── codeAndExecution.html
│   │   ├── mathKatex.html
│   │   ├── groundingCitations.html
│   │   └── multimodalUserUpload.html
│   ├── mocks/
│   │   └── chrome.ts                  # Mock Chrome Extension APIs (tabs, scripting, downloads)
│   └── integration/
│       ├── messagePassing.test.ts     # Popup <-> Content script message passing
│       └── buildVerification.test.ts  # Verifies dist/ cleanliness & MV3 compliance
│
├── docs/                              # COMPREHENSIVE DOCUMENTATION
│   ├── ARCHITECTURE.md
│   ├── GEMINI_DOM_SPEC.md
│   ├── EXPORTERS.md
│   ├── TESTING.md
│   ├── PACKAGING.md
│   └── SECURITY.md
│
├── plans/
│   └── modernization_plan.md          # This plan
├── CHROMEWEBSTORE.md                  # Store listing & permissions justification
├── package.json                       # Dependencies & scripts
├── tsconfig.json                      # TypeScript configuration
├── vite.config.ts                     # Bundler configuration
└── vitest.config.ts                   # Vitest configuration with JSDOM
```

---

## 3. Gemini Feature Compatibility Matrix

| Feature | Legacy Behavior | Modernized Behavior |
|---|---|---|
| **Thinking / Deep Reasoning** | Unhandled; thought text either leaked into main text or stripped inconsistently. | Extracted into `turn.thought`. Rendered as collapsible `<details>` in HTML, blockquotes / `> [!NOTE]` in Markdown, callout boxes in DOCX. |
| **Grounding Citations** | Dropped or rendered as unlinked numbers. | Extracted into `turn.citations` with title, URL, and snippet. Rendered as interactive links in HTML, footnotes in Markdown and DOCX. |
| **Python Code Execution** | Output cells (stdout, plots, tables) dropped. | Scraped as execution input code and execution result blocks. |
| **LaTeX / KaTeX Math** | Corrupted or lost math symbols. | Extracts TeX source from KaTeX annotations. Rendered as `$inline$` / `$$block$$` in Markdown, formatted spans in HTML. |
| **Multimodal User Prompts** | Only text extracted from `.query-text`; user images and uploaded files dropped. | Extracts user image attachments, uploaded code files, and PDFs into `turn.attachments`. |
| **Markdown Tables** | Broken or converted to raw plain text. | Preserved cleanly via `turndown-plugin-gfm`. |
| **HTML Sanitization** | Raw Gemini HTML inserted into export file (XSS risk). | Sanitized through DOMPurify with strict tag and attribute whitelisting. |
| **Output Formats** | Markdown, DOCX, HTML Single, HTML ZIP. | Markdown, DOCX, HTML Single, HTML ZIP, and Structured JSON. |

---

## 4. Testing Plan & Quality Gates

### 4.1 Unit Testing
- **DOM Scrapers (`tests/unit/content/`)**: Tests against DOM fixtures created from live Gemini sessions covering basic text, thinking traces, KaTeX equations, grounding cards, code blocks, and user attachments.
- **Exporters (`tests/unit/exporters/`)**: Verifies data serialization, formatting compliance, image placeholder resolution, and valid zip/docx/html generation.
- **Security (`tests/unit/security/`)**: Validates sanitization against aggressive XSS vectors (e.g. `<script>`, `onerror`, `javascript:`, data URI execution).

### 4.2 Integration & Build Verification
- **Chrome Mocking (`tests/mocks/chrome.ts`)**: Mocks `chrome.tabs`, `chrome.scripting`, `chrome.downloads`, and `chrome.runtime`.
- **Packaging Integrity (`tests/integration/buildVerification.test.ts`)**:
  - Confirms `dist/` contains only valid runtime assets (`manifest.json`, bundled scripts, HTML, CSS, icons).
  - Confirms no test files, `.ts` source files, or `node_modules` leak into `dist/`.
  - Asserts all icons declared in `manifest.json` exist as valid PNG files.

---

## 5. Implementation Milestones

1. **Milestone 1: Project Setup & Build Pipeline**
   - Initialize `package.json`, `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts`.
   - Setup multi-entry bundling from `src/` to `dist/`.
2. **Milestone 2: Modular Scraper Architecture**
   - Implement `types.ts`, `extractor.ts`, and specialized scrapers for turns, thinking traces, math, code, citations, and images.
3. **Milestone 3: Exporters & Sanitization**
   - Implement DOMPurify sanitization.
   - Upgrade Markdown, DOCX, HTML Single, HTML Linked, and add JSON exporter.
4. **Milestone 4: Modern Popup UI**
   - Update popup with format buttons, JSON option, theme preview, and export options.
5. **Milestone 5: Comprehensive Automated Test Suite**
   - Write HTML fixtures and unit/integration tests with Vitest.
6. **Milestone 6: Documentation & Chrome Web Store Readiness**
   - Create documentation suite in `docs/` and `CHROMEWEBSTORE.md`.
