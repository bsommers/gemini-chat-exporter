# Gemini Chat Exporter

> **⚠️ Disclaimer:** This software is provided "as is" with no warranty. All users assume full responsibility for its use. See [DISCLAIMER.md](DISCLAIMER.md) for details.

A Chrome extension that lets you export any [Gemini](https://gemini.google.com) chat session to four formats with one click.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

---

## Features

| Format | Output | Notes |
|---|---|---|
| **Markdown** | `.md` | Code fences, headings, image links |
| **Word Document** | `.docx` | Formatted styles, tables, embedded images |
| **Single Webpage** | `.html` | Self-contained, images as base64 |
| **Webpage + Images** | `.zip` | `index.html` + `styles.css` + `images/` folder |

---

## Installation

> No Chrome Web Store listing yet — load the extension manually.

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right)
4. Click **Load unpacked** and select the `gemini-chat-exporter` folder
5. The **Gemini Exporter** icon appears in your Chrome toolbar

---

## Usage

1. Open [gemini.google.com](https://gemini.google.com) and log in
2. Open any existing conversation (or start one)
3. Click the **Gemini Exporter** icon in the toolbar
4. Click your desired export format — the file downloads automatically

> **Note:** If you had Gemini open before installing the extension, just click the popup — it will auto-inject itself without requiring a page reload.

---

## How It Works

```
popup.js  ──sendMessage──▶  content.js (runs on gemini.google.com)
                                │
                                │  walks DOM: <user-query>, <model-response>
                                │  extracts text, HTML, images
                                ▼
              structured JSON { title, turns[], images[] }
                                │
popup.js  ──sendMessage──▶  background.js (service worker)
                                │
                    ┌───────────┼───────────────┐
                    ▼           ▼               ▼
              markdown.js  html_single.js   docx_export.js
              html_linked.js                jszip + docx.js
                                │
                       chrome.downloads.download()
```

**DOM selectors used:**

| Element | Selector |
|---|---|
| Chat container | `infinite-scroller.chat-history` |
| User turn | `user-query` (custom element) |
| User text | `.query-text` |
| AI response | `model-response` (custom element) |
| Response body | `.markdown` |
| Code blocks | `code-block` → `pre > code` |
| Images | `img` inside `model-response` |

---

## Project Structure

```
gemini-chat-exporter/
├── manifest.json           # Manifest V3
├── popup.html/css/js       # Toolbar popup UI
├── content.js              # DOM scraper (injected into Gemini)
├── background.js           # Service worker + download handler
├── exporters/
│   ├── markdown.js         # HTML → Markdown via Turndown
│   ├── html_single.js      # Self-contained HTML (base64 images)
│   ├── html_linked.js      # HTML + images in a ZIP
│   └── docx_export.js      # Word .docx via docx.js
├── lib/
│   ├── turndown.min.js     # 27 KB
│   ├── jszip.min.js        # 96 KB
│   └── docx.min.js         # 726 KB
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── LICENSE                 # GPL-3.0
└── DISCLAIMER.md
```

---

## Requirements

- **Chrome** 88+ (Manifest V3 support)
- A **Google account** logged into Gemini

---

## Known Limitations

- Gemini's DOM structure may change, potentially breaking the extension
- Very long chats with many large images may take a few seconds to export
- The DOCX export uses a simplified HTML parser — highly complex nested formatting may not render perfectly in Word

---

## License

GPL-3.0 — see [LICENSE](LICENSE).

Copyright © 2024 Bill Sommers
