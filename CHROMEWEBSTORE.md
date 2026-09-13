# Chrome Web Store Metadata & Listing Specification

> **Single Source of Truth** for Chrome Web Store Developer Dashboard listing metadata, permissions justifications, privacy disclosures, and version history.

---

## 1. Store Listing Metadata

| Field | Value / Content | Character Limit / Requirement |
|---|---|---|
| **Extension Name** | Gemini Chat Exporter | Max 45 characters (Current: 20) |
| **Short Description** | Export Gemini chat sessions to Markdown, Word (.docx), Single Webpage, ZIP, or JSON. | Max 132 characters (Current: 86) |
| **Category** | Productivity / Developer Tools | Required |
| **Language** | English | Primary |
| **Version** | 1.1.0 | Must match `manifest.json` |

### Detailed Store Description

```text
Export your Google Gemini (gemini.google.com) conversations to 5 document formats with a single click.

Whether you need to save chat histories into your personal knowledge base (Obsidian, Notion, Logseq), share formatted reports in Microsoft Word, archive chats with offline images, or create structured JSON backups, Gemini Chat Exporter handles it seamlessly on your local device.

✨ KEY FEATURES:
• 📝 Markdown (.md): Export with code fences, syntax highlighting, LaTeX math equations ($inline$ and $$block$$), GFM tables, and Deep Think / Thinking process callouts.
• 📄 Word Document (.docx): Cleanly styled Microsoft Word documents with headers, tables, callout boxes, and embedded images.
• 🌐 Single Webpage (.html): Self-contained, portable HTML file with dark/light theme toggle and images embedded as base64 data URIs (no internet required to view).
• 🗂️ Webpage + Images (.zip): Complete archive containing index.html, styles.css, and a separate images/ folder with full-resolution extracted assets.
• 📊 Structured JSON (.json): Complete normalized chat transcript schema for developers, LLM pipelines, and backups.

🧠 FULL SUPPORT FOR MODERN GEMINI CAPABILITIES:
• Thinking Process & Deep Reasoning traces (collapsible and formatted)
• Google Search Grounding sources & citation footnotes
• Python Code Execution cells with input code and stdout outputs
• LaTeX & KaTeX mathematical formulas
• Multimodal user uploads (user-attached images and files)

🔒 PRIVACY & SECURITY FIRST:
• 100% Client-Side: All processing, conversion, and packaging happens in your browser.
• Zero Telemetry: No external tracking, analytics, or remote API requests.
• Built-in XSS Sanitization: All HTML output is sanitized via DOMPurify before export.

HOW TO USE:
1. Open any chat on gemini.google.com.
2. Click the Gemini Chat Exporter icon in your toolbar.
3. Choose your desired export format — the file will download automatically.
```

---

## 2. Permissions Justifications (Plain-English Review Justifications)

The Chrome Web Store review team requires explicit, specific explanations for every requested permission.

| Permission / Host Permission | Review Justification |
|---|---|
| `downloads` | Required to trigger local file downloads (`.md`, `.docx`, `.html`, `.zip`, `.json`) directly to the user's default Downloads folder without intermediate server round-trips. |
| `scripting` | Required to inject `content.js` on-demand into Gemini tabs that were opened prior to installing or updating the extension, eliminating the need for users to reload active tabs. |
| `activeTab` | Required to access and interact with the active Gemini tab when the user clicks the extension action icon. |
| `tabs` | Required to read the URL and title of the active tab to confirm the user is on `gemini.google.com` and generate an accurate document filename from the chat title. |
| `host_permissions: https://gemini.google.com/*` | Restricts content script execution and DOM scraping strictly to Google Gemini domains. The extension cannot interact with or access any other websites. |

---

## 3. Privacy & Data Use Disclosures

| Disclosure Item | Declaration | Details |
|---|---|---|
| **Single Purpose** | Yes | Exporting active Google Gemini chat sessions to local document files. |
| **Collects Personal Data?** | **No** | No user identifiers, emails, names, or accounts are collected. |
| **Collects Health/Financial Info?** | **No** | None. |
| **Collects Authentication Info?** | **No** | Session cookies are used strictly in-memory by standard browser fetch for downloading images already present on the active page. No credentials or session tokens are stored, logged, or transmitted. |
| **Collects Web History?** | **No** | Only interacts with the active `gemini.google.com` tab upon user click. |
| **Transfers Data to Third Parties?** | **No** | Zero data is transferred off the user's computer. |

---

## 4. Version History

- **v1.1.0** *(Modernization Release)*:
  - Added support for Gemini Thinking / Deep Reasoning trace extraction.
  - Added LaTeX / KaTeX math equation extraction and Markdown math formatting.
  - Added Grounding citations & web sources extraction.
  - Added Python code execution cell extraction.
  - Added user multimodal attachment extraction.
  - Added Structured JSON export format.
  - Integrated DOMPurify HTML sanitization for XSS prevention.
  - Migrated to clean `src/` $\rightarrow$ `dist/` bundling pipeline with full automated Vitest suite.
- **v1.0.0** *(Initial Release)*:
  - Initial support for Markdown, DOCX, Single HTML, and HTML ZIP exports.
