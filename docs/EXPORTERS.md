# Export Formats Specification & Exporter Guide

## 1. Overview

`gemini-chat-exporter` transforms normalized `ChatData` objects into 5 distinct target formats. This document specifies the conversion rules, styling guidelines, and structural output for each exporter.

---

## 2. Exporter Matrix

| Format | Target Extension | Engine / Libraries | Primary Use Case |
|---|---|---|---|
| **Markdown** | `.md` | `TurndownService` + `turndown-plugin-gfm` | Note-taking apps (Obsidian, Notion, Logseq), GitHub, documentation. |
| **Word Document** | `.docx` | `docx` (v8+) | Professional reports, enterprise sharing, Microsoft Word, Google Docs. |
| **Single Webpage** | `.html` | Custom HTML5 template + DOMPurify | Self-contained, portable, interactive viewing in any browser (zero external assets). |
| **Webpage + Images** | `.zip` | `JSZip` + DOMPurify | Archival, web hosting, extracting standalone image assets. |
| **Structured JSON** | `.json` | Native JSON serializer | Machine interchange, data backup, automated LLM dataset pipelines. |

---

## 3. Format Specifications

### 3.1 Markdown Exporter (`src/exporters/markdown.ts`)

Converts HTML turns into clean GitHub Flavored Markdown (GFM).

**Conversion Rules:**
1. **Header Metadata:**
   ```markdown
   # Conversation Title
   
   *Exported from Google Gemini on YYYY-MM-DD HH:MM:SS*
   
   ---
   ```
2. **User Turns:**
   ```markdown
   ## 👤 You
   
   Prompt text goes here...
   
   ![Uploaded Image](user-upload-0.png)
   
   ---
   ```
3. **Thinking Process (if present):**
   ```markdown
   ## 🤖 Gemini
   
   > [!NOTE]
   > **Thinking Process (12s)**
   > 
   > Reasoning steps and internal thoughts...
   
   Main response content...
   ```
4. **Code Blocks:**
   Fenced code blocks with language identifiers:
   ````markdown
   ```python
   import numpy as np
   print("Quantum state initialized")
   ```
   ````
   If execution output exists:
   ```markdown
   **Output:**
   ```
   Quantum state initialized
   ```
   ```
5. **LaTeX Formulas:**
   - Inline math: `$E = mc^2$`
   - Block equations:
     ```markdown
     $$
     |\psi\rangle = \frac{|00\rangle + |11\rangle}{\sqrt{2}}
     $$
     ```
6. **Tables:**
   Rendered with GFM pipe table format:
   ```markdown
   | Metric | Score | Notes |
   | --- | --- | --- |
   | Accuracy | 98.5% | Validation set |
   ```
7. **Grounding Citations & Footnotes:**
   Numbered footnotes at the end of the response:
   ```markdown
   ### Sources
   1. [Nature - Quantum Physics](https://nature.com/articles/...)
   2. [arXiv - Entanglement Studies](https://arxiv.org/abs/...)
   ```

---

### 3.2 Word Document Exporter (`src/exporters/docx.ts`)

Builds native `.docx` binary files using `docx.js`.

**Visual Styling & Hierarchy:**
- **Title:** Heading 1, 28pt, Deep Blue (`#1A73E8`).
- **Metadata:** 10pt Italic Muted Gray (`#666666`).
- **User Header:** 12pt Bold, Purple (`#6B2FBA`), with bottom border accent (`#BD93F9`).
- **Gemini Header:** 12pt Bold, Blue (`#1A73E8`), with bottom border accent (`#8AB4F8`).
- **Thinking Callout:** Shaded box (`#F0F4F8`), left accent border (`#8AB4F8`, size 6), 10.5pt italicized text.
- **Code Blocks:** Shaded rectangle (`#F5F7FA`), Courier New / Consolas, 9.5pt, 1pt border.
- **Tables:** Styled headers with light blue background (`#E8F0FE`), centered borders (`#CCCCCC`), padded cells.
- **Images:** Embedded via `ImageRun` using decoded `ArrayBuffer` buffers with proportional dimensions (max width: 500pt).

---

### 3.3 Single Webpage HTML Exporter (`src/exporters/htmlSingle.ts`)

Generates a standalone, fully self-contained HTML5 file.

**Features:**
- **Zero External Dependencies:** No external fonts, scripts, or CDNs required.
- **Embedded Media:** All images embedded directly as base64 Data URIs (`src="data:image/png;base64,..."`).
- **Interactive Controls:**
  - Built-in Dark / Light theme toggle.
  - Interactive collapsible `<details>` for Thinking Process traces.
  - One-click copy buttons on code blocks.
- **Security:** Strict HTML sanitization via DOMPurify to neutralize script injection risks.

**CSS Theme Variables:**
```css
:root {
  --bg-primary: #0f1117;
  --bg-secondary: #1a1b2e;
  --bg-card: rgba(255, 255, 255, 0.04);
  --text-primary: #e0e0ff;
  --text-muted: #aab4d4;
  --accent-user: #bd93f9;
  --accent-model: #8ab4f8;
  --border-color: rgba(138, 180, 248, 0.15);
  --code-bg: #191a2e;
}

[data-theme="light"] {
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-card: #f1f3f4;
  --text-primary: #202124;
  --text-muted: #5f6368;
  --accent-user: #7b1fa2;
  --accent-model: #1a73e8;
  --border-color: #dadce0;
  --code-bg: #f1f3f4;
}
```

---

### 3.4 Webpage + Images ZIP Exporter (`src/exporters/htmlLinked.ts`)

Creates a standard ZIP archive structure using `JSZip`:

```
exported-chat.zip
├── index.html            # Main conversation HTML
├── styles.css            # Extracted stylesheet
├── README.txt            # Archive manifest & timestamp
└── images/               # Extracted images directory
    ├── image-0.png
    ├── image-1.png
    └── user-upload-0.png
```

- Image references in `index.html` use relative paths: `<img src="images/image-0.png" />`.
- Enables easy asset reuse and lightweight web publishing.

---

### 3.5 Structured JSON Exporter (`src/exporters/json.ts`)

Exports the raw normalized `ChatData` object:

```json
{
  "title": "Quantum Entanglement Analysis",
  "url": "https://gemini.google.com/app/1a2b3c4d",
  "exportedAt": "2026-08-27T16:00:00.000Z",
  "turns": [
    {
      "id": "turn-0",
      "role": "user",
      "text": "Can you explain quantum entanglement?",
      "html": "<p>Can you explain quantum entanglement?</p>",
      "attachments": []
    },
    {
      "id": "turn-1",
      "role": "model",
      "thought": {
        "text": "Analyzing the principles of superposition...",
        "duration": "12s"
      },
      "text": "Quantum entanglement is...",
      "html": "<p>Quantum entanglement is...</p>",
      "citations": [
        {
          "index": 1,
          "title": "Nature Physics",
          "url": "https://nature.com/articles/..."
        }
      ]
    }
  ]
}
```
