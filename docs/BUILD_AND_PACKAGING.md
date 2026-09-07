# Build, Packaging, and Distribution Guide

This document explains how Gemini Chat Exporter is tested, packaged, and distributed, separating the Chrome Extension runtime from development files, documentation, and the test suite.

---

## 🚀 Quick Commands

```bash
# 1. Install dependencies (JSDOM for unit testing)
npm install

# 2. Run the automated test suite (Node 20 native test runner)
npm test

# 3. Build the clean unpacked extension and release archive
npm run build
```

---

## 📦 What `npm run build` Produces

When you run `npm run build` (which executes `scripts/package.mjs`), the script creates a clean `dist/` directory containing:

```
dist/
├── unpacked/                              # Clean directory for Chrome "Load unpacked"
│   ├── manifest.json                     # Manifest V3 configuration
│   ├── background.js                     # Background service worker
│   ├── content.js                        # Gemini DOM scraper
│   ├── popup.html                        # Extension popup view
│   ├── popup.css                         # Extension popup styles
│   ├── popup.js                          # Extension popup logic
│   ├── exporters/                        # Format conversion modules
│   │   ├── markdown.js
│   │   ├── json_export.js
│   │   ├── docx_export.js
│   │   ├── html_single.js
│   │   └── html_linked.js
│   ├── lib/                              # Vendored libraries (turndown, jszip, docx)
│   └── icons/                            # Extension icons (16, 48, 128)
└── gemini-chat-exporter-v1.1.0.zip        # Standalone release archive for distribution
```

### Why `dist/unpacked/` is Clean:
The unpacked directory deliberately **excludes**:
- `tests/` and test harness files
- `docs/` and markdown files
- `scripts/`
- `node_modules/`
- `package.json` and `package-lock.json`
- `.git/`, `.gitignore`, and IDE configuration

This allows users or developers to point Chrome directly to `dist/unpacked/` without importing unnecessary files into their browser.

---

## 🌐 Loading into Chrome

1. Open Google Chrome.
2. In the URL bar, go to `chrome://extensions`.
3. In the top-right corner, toggle on **Developer mode**.
4. Click **Load unpacked** in the top-left corner.
5. Select the `dist/unpacked` directory created by `npm run build` (or the repository root if developing).
6. The **Gemini Exporter** icon will now appear in your extensions list and toolbar.

---

## 🧪 Testing Pipeline

The project uses Node 20's built-in test runner (`node:test`) and JSDOM to test all DOM interactions and export algorithms:

| Test File | Coverage |
|---|---|
| `tests/sanity.test.mjs` | JSDOM environment and script evaluation |
| `tests/content_extraction.test.mjs` | Code block replacement, KaTeX LaTeX math, thinking blocks, user attachments, sidebar conversation title scoping |
| `tests/markdown.test.mjs` | GFM tables, pipe escaping, KaTeX math rules, collapsible thinking blocks, placeholder image replacement |
| `tests/json.test.mjs` | Structured JSON schema validation, turns, timestamps, thought content, attachment metadata |
| `tests/html.test.mjs` | Single HTML data URI embedding, linked HTML ZIP generation and file structure |
| `tests/docx.test.mjs` | Word document generation, proportional image bounds, nested list recursion |
| `tests/packaging.test.mjs` | Automated verification that `npm run build` includes all runtime files and excludes all dev files |

Run the tests at any time:
```bash
npm test
```
