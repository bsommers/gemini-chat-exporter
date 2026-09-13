# Gemini Chat Exporter: Architecture Specification

## 1. Architectural Overview

**Gemini Chat Exporter** is a Manifest V3 Chrome extension architected to extract, normalize, and export structured conversations from Google Gemini (`https://gemini.google.com`) into multiple document formats entirely on the user's local machine.

```mermaid
graph TD
    subgraph Browser Tab Context [gemini.google.com]
        DOM[Gemini Chat DOM Tree]
        CS[content.js / extractor.ts]
        CS_T[Thought Scraper]
        CS_M[Math Scraper]
        CS_C[Citation Scraper]
        CS_P[Python Execution Scraper]
        CS_U[User Attachment Scraper]
        CS_I[Image Scraper & Base64 Encoder]
    end

    subgraph Popup Context [popup.html / popup.js]
        P_UI[Popup UI Controller]
        EX_MD[Markdown Exporter]
        EX_DOCX[DOCX Exporter]
        EX_HTML_S[HTML Single Exporter]
        EX_HTML_L[HTML Linked ZIP Exporter]
        EX_JSON[JSON Exporter]
        SAN[DOMPurify Sanitizer]
    end

    subgraph Service Worker [background.js]
        SW[Lifecycle & Context Menu Handler]
    end

    subgraph Chrome Platform APIs
        API_TABS[chrome.tabs]
        API_SCR[chrome.scripting]
        API_DL[chrome.downloads]
        API_MSG[chrome.runtime]
    end

    %% Interactions
    P_UI -->|Query active tab| API_TABS
    P_UI -->|Inject if missing| API_SCR
    P_UI -->|extractChat msg| CS
    CS --> CS_T & CS_M & CS_C & CS_P & CS_U & CS_I
    CS -->|Query nodes| DOM
    CS -->|Structured ChatData| P_UI
    P_UI --> SAN
    SAN --> EX_MD & EX_DOCX & EX_HTML_S & EX_HTML_L & EX_JSON
    EX_MD & EX_DOCX & EX_HTML_S & EX_HTML_L & EX_JSON -->|Blob / Object URL| API_DL
```

---

## 2. Component Boundaries & Context Separation

### 2.1 Content Script Context (`src/content/`)
- **Execution Target:** Injected into `https://gemini.google.com/*` tabs.
- **Execution Model:** Runs in an isolated world with access to the Gemini web page's DOM.
- **Responsibilities:**
  - Locate conversation nodes (`user-query`, `model-response`).
  - Extract user prompt text and multimodal attachments (images, uploaded files, PDFs).
  - Extract model response text, HTML, and specialized children:
    - Thinking & reasoning traces (`<thought-box>`, `.thought-container`).
    - LaTeX / KaTeX mathematical formulas.
    - Code blocks and interactive Python execution output cells.
    - Web search citations, grounding chips, and source links.
  - Asynchronously fetch embedded response images (using session cookies) and convert them to base64 Data URIs with proper MIME types.
  - Return normalized, strongly typed `ChatData` JSON structure to the caller.

### 2.2 Popup Context (`src/popup/`)
- **Execution Target:** Opened when user clicks the extension action icon in the toolbar.
- **Execution Model:** Full DOM-enabled extension window (`popup.html`).
- **Responsibilities:**
  - Query the currently active Gemini tab via `chrome.tabs.query`.
  - Ensure `content.js` is active; on-demand inject via `chrome.scripting.executeScript` if the tab predates extension installation.
  - Request chat extraction via `chrome.tabs.sendMessage`.
  - Provide interactive user controls:
    - Export format triggers (Markdown, Word .docx, Single HTML, ZIP, JSON).
    - Export options (e.g. Include Thinking Process, Theme mode).
  - Execute exporter pipelines (`src/exporters/`) within the popup's DOM environment where `document`, `Blob`, `FileReader`, and `URL.createObjectURL` are available.
  - Dispatch file downloads via `chrome.downloads.download`.

### 2.3 Background Service Worker (`src/background/`)
- **Execution Target:** Ephemeral Manifest V3 background service worker.
- **Execution Model:** Event-driven, non-persistent, DOM-free background thread.
- **Responsibilities:**
  - Extension lifecycle management (install, update).
  - Optional context menu registration (e.g. "Export this chat").
  - Strictly **no** DOM manipulation or global in-memory state persistence.

---

## 3. Data Pipeline & Message Passing Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Popup as Popup UI (popup.js)
    participant Tabs as chrome.tabs / scripting
    participant CS as Content Script (content.js)
    participant DOM as Gemini Page DOM
    participant Exporter as Exporter Engine & Sanitizer
    participant Downloads as chrome.downloads

    User->>Popup: Clicks extension icon
    Popup->>Tabs: Query active tab (URL matches gemini.google.com)
    Tabs-->>Popup: Tab Info
    Popup->>CS: sendMessage({ action: "getTitle" })
    alt Content script not yet injected
        Popup->>Tabs: scripting.executeScript(content.js)
        Popup->>CS: retry sendMessage({ action: "getTitle" })
    end
    CS-->>Popup: Return detected chat title
    Popup->>User: Renders title & enabled format buttons

    User->>Popup: Clicks format button (e.g. Markdown)
    Popup->>CS: sendMessage({ action: "extractChat", options })
    CS->>DOM: Walk DOM tree, extract turns, math, citations, thoughts
    CS->>CS: imgToBase64() for embedded images
    CS-->>Popup: Resolves ChatData object
    Popup->>Exporter: transformToFormat(ChatData)
    Exporter->>Exporter: DOMPurify sanitization & formatting
    Exporter-->>Popup: Return Blob / text
    Popup->>Downloads: chrome.downloads.download({ url: objectUrl, filename })
    Downloads-->>User: File saved to Downloads folder
    Popup->>User: Display success checkmark
```

---

## 4. Normalized Data Schema (`ChatData`)

All scrapers produce and all exporters consume a unified, immutable TypeScript data schema:

```typescript
export interface Citation {
  index: number;
  title: string;
  url: string;
  snippet?: string;
}

export interface Attachment {
  type: 'image' | 'file' | 'audio';
  name?: string;
  src?: string;
  base64?: string;
  mimeType?: string;
}

export interface CodeBlock {
  language: string;
  code: string;
  executionOutput?: string;
}

export interface Turn {
  id: string;
  role: 'user' | 'model';
  timestamp?: string;
  text: string;
  html: string;
  thought?: {
    text: string;
    html: string;
    duration?: string;
  };
  attachments?: Attachment[];
  citations?: Citation[];
  codeBlocks?: CodeBlock[];
}

export interface ImageMeta {
  id: string;
  src: string;
  alt: string;
  base64: string | null;
  mimeType: string;
  ext: string;
}

export interface ChatData {
  title: string;
  url?: string;
  exportedAt: string;
  geminiModelVersion?: string;
  turns: Turn[];
  images: ImageMeta[];
}
```

---

## 5. Security & Privacy Architecture

1. **Zero External Network Calls:**
   - The extension makes **zero** outbound network requests to third-party servers, analytics services, or external APIs.
   - All transformations (Markdown, HTML, DOCX, ZIP, JSON) are computed entirely in memory on the client machine.
2. **Credentialed Image Fetching:**
   - Gemini images stored on internal Google CDNs require session cookies. `content.js` uses `fetch(img.src, { credentials: 'include' })` strictly for URLs already present in the Gemini DOM. Credentials are never stored, logged, or transferred.
3. **Defense-in-Depth HTML Sanitization:**
   - All HTML content rendered by Gemini is passed through DOMPurify before inclusion into exported HTML or DOCX files to prevent Cross-Site Scripting (XSS) vectors.
4. **Principle of Least Privilege:**
   - Host permissions are strictly locked to `https://gemini.google.com/*`.
   - Permissions are restricted to `downloads`, `scripting`, `activeTab`, and `tabs`.
