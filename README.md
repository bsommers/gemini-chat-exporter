# Gemini Chat Exporter

> **⚠️ Disclaimer:** This software is provided "as is" with no warranty. All users assume full responsibility for its use. See [DISCLAIMER.md](DISCLAIMER.md) for details.

A privacy-first, zero-telemetry Chrome extension (Manifest V3) that exports any [Gemini](https://gemini.google.com) conversation to Markdown, Word Document, Webpage, ZIP, or structured JSON in one click.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

---

## Features

| Format | Output | Capabilities |
|---|---|---|
| **Markdown** | `.md` | GFM tables, language-fenced code blocks, KaTeX math expressions, expandable thinking process blocks, image references |
| **Word Document** | `.docx` | Headings, nested lists, tables with shaded headers, thinking blocks, proportional image scaling |
| **Single Webpage** | `.html` | Self-contained dark-mode document with base64 embedded images, formatted tables, LaTeX math, and thinking details |
| **Webpage + Images** | `.zip` | `index.html` + `styles.css` + separate `images/` directory with relative paths |
| **Structured JSON** | `.json` | Full conversation metadata, title, ISO timestamps, user turns, model turns, thinking thoughts, attachments, and base64 assets |
| **Copy to Clipboard** | Clipboard | Instant 1-click copy of full Markdown conversation to clipboard |

---

## Installation & Distribution

### Option A: Use the Clean Pre-built Extension (`dist/unpacked`)
For the cleanest installation without developer files, tests, or documentation:

1. Clone or download this repository.
2. Build the distribution:
   ```bash
   npm install
   npm run build
   ```
   This generates:
   - `dist/unpacked/`: Clean directory containing only Chrome runtime files.
   - `dist/gemini-chat-exporter-v1.1.0.zip`: Standalone release package ready to distribute.
3. Open Chrome and navigate to `chrome://extensions`.
4. Toggle on **Developer mode** in the top-right corner.
5. Click **Load unpacked** and select the `dist/unpacked` folder (or the root project directory).
6. The **Gemini Exporter** icon appears in your Chrome toolbar.

---

## Usage

1. Open [gemini.google.com](https://gemini.google.com) and log in.
2. Open any conversation.
3. Click the **Gemini Exporter** icon in your toolbar.
4. Click your desired export format or **Copy to Clipboard**. The file downloads automatically.

> **Tip:** If you already had a Gemini tab open before installing or updating the extension, click the popup — it automatically injects `content.js` without requiring a page refresh.

---

## How It Works

```
                       ┌─────────────────────────┐
                       │  gemini.google.com Tab  │
                       │       (content.js)      │
                       └────────────┬────────────┘
                                    │
                       1. Scrapes turns, KaTeX math,
                          code blocks, thinking blocks,
                          user attachments, images
                                    ▼
┌────────────────────────────────────────────────────────┐
│                      Extension Popup                   │
│                        (popup.js)                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │                   Exporters                      │  │
│  │ • markdown.js (Turndown + GFM table / math rules)│  │
│  │ • json_export.js (Structured JSON schema)        │  │
│  │ • docx_export.js (docx.js + proportional bounds) │  │
│  │ • html_single.js & html_linked.js (JSZip)        │  │
│  └──────────────────────────────────────────────────┘  │
└────────────┬─────────────────────────────┬─────────────┘
             │                             │
             ▼                             ▼
   chrome.downloads.download()    navigator.clipboard.writeText()
```

### Modern DOM Selectors Used:

| Element | Selector / Strategy |
|---|---|
| Chat Container | `infinite-scroller.chat-history` |
| User Turns | `user-query` |
| AI Turns | `model-response` |
| Conversation Title | Active sidebar conversation link (`[data-test-id="conversation-title"]`, selected anchor) with fallback to header title, first user prompt, and document title |
| Code Blocks | `code-block` elements converted to `<pre><code class="language-...">` with buttons stripped |
| LaTeX Math | KaTeX annotations (`<annotation encoding="application/x-tex">`) converted to `$math$` or `$$math$$` |
| Thinking Blocks | `<details class="gemini-thought">` preserving model reasoning steps |
| User Attachments | Uploaded images extracted and mapped to `turn.attachments` |

---

## Development & Testing

This project uses Node.js 20's native test runner (`node:test`) and JSDOM to test extraction and export logic without browser dependencies:

```bash
# Run unit test suite (20+ tests)
npm test

# Build unpacked extension and zip release
npm run build
```

## Documentation

- [Build & Packaging Guide](docs/BUILD_AND_PACKAGING.md) — Packaging pipeline, clean `dist/unpacked`, and distribution archives.
- [Architecture & Modernization Reference](docs/ARCHITECTURE.md) — DOM selectors, KaTeX math parsing, thinking blocks, and intermediate data schema.
- [Security Notes](docs/SECURITY.md) — Manifest V3 permissions, threat model, and zero-telemetry design.

---

## License

GPL-3.0 — see [LICENSE](LICENSE).

Copyright © 2024–2026 Bill Sommers
