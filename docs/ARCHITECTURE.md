# Architecture & Modernization Reference

This document details the internal architecture, modern DOM selectors, data structures, and pipeline flow for Gemini Chat Exporter v1.1.0.

---

## 🏛️ System Architecture

```
                       ┌─────────────────────────┐
                       │  gemini.google.com Tab  │
                       │       (content.js)      │
                       └────────────┬────────────┘
                                    │
                                    │ 1. Scrapes conversation turns
                                    │    Processes KaTeX, code blocks,
                                    │    thinking blocks, user attachments
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

---

## 🔍 Modern DOM Extraction Logic (`content.js`)

Gemini's web interface (`gemini.google.com`) uses custom elements and web components:

### 1. Conversation Scoping
- **Container:** `infinite-scroller.chat-history` (or `body` as fallback)
- **User Turn:** `<user-query>`
- **Model Turn:** `<model-response>`

### 2. Conversation Title Extraction
Title detection uses a robust cascade to find the active conversation:
1. Active selected sidebar conversation link (`[data-test-id="conversation-title"]`, selected anchor)
2. Main page conversation title header (`header .title`, `h1`)
3. First user query snippet (truncated to 40 characters)
4. Sanitized `document.title` (ignoring generic values like "Gemini")

### 3. Code Block Cleaning (`cleanCodeBlocks`)
- Queries all custom `code-block` elements directly in the cloned DOM tree.
- Converts to standard `<pre><code class="language-...">`.
- Normalizes language attributes and strips UI decorations (copy buttons, formatting buttons).
- Accurately captures language identifiers with symbols (e.g. `c++`, `c#`).

### 4. KaTeX Math Extraction (`cleanKatexMath`)
- Modern Gemini renders mathematical formulas using KaTeX.
- Extraction inspects `<annotation encoding="application/x-tex">` or `[data-tex]`.
- Distinguishes between:
  - **Inline Math:** Wrapped in `$formula$`
  - **Display Math:** Wrapped in `$$formula$$` (when parent is `.katex-display` or `display="block"`)

### 5. Thinking Process Blocks (`processThinkingBlocks`)
- Gemini 2.0+ reasoning/thinking blocks are extracted from `.thinking-process`, `<expandable-block>`, or `.thought-box`.
- Preserved as standard HTML `<details class="gemini-thought"><summary>Thinking Process</summary><div class="thought-content">...</div></details>`.
- Preserved across all exporters:
  - **Markdown:** Fenced `<details class="gemini-thought">`
  - **JSON:** Explicit `turn.thought` string field
  - **DOCX:** Formatted with italics and distinct margin indentation
  - **HTML:** Dark mode collapsible accordion styled box

### 6. Multimodal User Attachments
- Identifies user-uploaded images and documents from `<user-query>`.
- Stored on each turn as `turn.attachments: [{ type: 'image', id: 'image-0', alt: '...' }]`.
- Concurrently downloaded via `fetch` with a bounded concurrency pool (`CONCURRENCY_LIMIT = 5`).

---

## 📤 Intermediate Data Contract (`chatData`)

The content script returns an intermediate data object consumed by all exporters:

```json
{
  "title": "Quantum Computing Primer",
  "turns": [
    {
      "role": "user",
      "text": "Explain Shor's algorithm",
      "attachments": []
    },
    {
      "role": "model",
      "text": "Shor's algorithm solves prime factorization...",
      "html": "<p>Shor's algorithm solves prime factorization...</p>",
      "thought": "The user is asking for a conceptual primer..."
    }
  ],
  "images": [
    {
      "id": "image-0",
      "src": "blob:https://gemini.google.com/...",
      "base64": "data:image/png;base64,...",
      "alt": "Quantum circuit diagram",
      "ext": "png"
    }
  ]
}
```

---

## 🔒 Security Architecture

1. **Manifest V3:** Adheres to modern Chrome Manifest V3 guidelines.
2. **Quarantined Code:** `web_accessible_resources` is completely removed to prevent host page scripts from accessing internal extension files.
3. **Local Processing:** No external servers, no cloud dependencies, zero telemetry.
4. **Idempotency:** `window.__geminiExporterLoaded` guards protect against duplicate execution.
