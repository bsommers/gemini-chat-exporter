# Gemini DOM Specification & Scraper Guide

## 1. Overview

This document provides a comprehensive mapping of Google Gemini's web client (`https://gemini.google.com`) DOM structure, Custom Elements, CSS classes, attributes, and extraction heuristics used by `gemini-chat-exporter`.

---

## 2. Top-Level Chat Hierarchy

Gemini renders conversations within an infinite scroller container. Each interaction consists of a paired `<user-query>` and `<model-response>`.

```html
<main>
  <infinite-scroller class="chat-history">
    <!-- Turn 1: User -->
    <user-query> ... </user-query>

    <!-- Turn 1: Model -->
    <model-response> ... </model-response>

    <!-- Turn 2: User -->
    <user-query> ... </user-query>

    <!-- Turn 2: Model -->
    <model-response> ... </model-response>
  </infinite-scroller>
</main>
```

---

## 3. Selector Mapping & Parsing Rules

### 3.1 Conversation Title

| Priority | Selector / Strategy | Description |
|---|---|---|
| **1** | `[data-test-id="conversation-title"]` / `.conversation-title.active` | Active conversation title in the left sidebar navigation. |
| **2** | `header .conversation-title`, `h1.chat-title` | Top bar chat heading element. |
| **3** | `document.title` | Cleans document title with regex `/\s*[-|]\s*Gemini.*$/i`. |
| **4** | First User Query Fallback | Truncates the text of the first user prompt (max 50 chars). |

---

### 3.2 User Turn Elements (`<user-query>`)

```html
<user-query>
  <!-- Text content container -->
  <div class="query-text" data-query-text="true">
    <p>Can you explain quantum entanglement?</p>
  </div>

  <!-- Multimodal Attachments (Images, files, audio) -->
  <div class="attachment-container">
    <div class="image-preview">
      <img src="blob:..." alt="uploaded-diagram.png" />
    </div>
    <div class="file-attachment-chip">
      <span class="file-name">data.csv</span>
    </div>
  </div>
</user-query>
```

**Extraction Rules:**
1. **Prompt Text:** Query `.query-text`, `[data-query-text]`, or direct text nodes.
2. **User Images:** Query `.image-preview img`, `img[src]`. Fetch blob/URL and encode to base64.
3. **User Files/Documents:** Query `.file-attachment-chip`, `.file-name` to extract attachment names and metadata.

---

### 3.3 Model Response Elements (`<model-response>`)

```html
<model-response>
  <div class="response-container">
    
    <!-- 1. Thinking / Deep Reasoning Block -->
    <div class="thought-container" data-thought-box="true">
      <button class="thought-toggle">Thinking Process (12s)</button>
      <div class="thought-content">
        <p>Analyzing the user's question regarding quantum mechanics...</p>
      </div>
    </div>

    <!-- 2. Main Response Body (Markdown) -->
    <div class="markdown response-content">
      <p>Quantum entanglement is a phenomenon where...</p>
      
      <!-- Code Block -->
      <code-block lang="python">
        <div class="code-block-header">
          <span class="code-lang">python</span>
          <button class="copy-button">Copy</button>
        </div>
        <pre><code class="language-python">import numpy as np</code></pre>
      </code-block>

      <!-- LaTeX / KaTeX Math -->
      <span class="math-inline">
        <span class="katex">
          <annotation encoding="application/x-tex">|\psi\rangle = \frac{|00\rangle + |11\rangle}{\sqrt{2}}</annotation>
        </span>
      </span>

      <!-- Python Execution / Output Cell -->
      <div class="code-execution-output">
        <div class="output-header">Output:</div>
        <pre class="stdout">State vector calculated successfully.</pre>
      </div>
    </div>

    <!-- 3. Grounding & Web Search Sources -->
    <div class="grounding-card sources-container">
      <div class="source-item">
        <a class="citation-link" href="https://nature.com/articles/..." target="_blank">
          <span class="source-index">1</span>
          <span class="source-title">Nature - Quantum Physics</span>
        </a>
      </div>
    </div>

  </div>
</model-response>
```

---

### 3.4 Deep Reasoning / Thinking Trace Extraction

- **Selectors:** `.thought-container`, `thought-box`, `details.thought-details`, `.thinking-process`, `[data-thought-box]`.
- **Extraction Strategy:**
  1. Extract thought text from `.thought-content` or inside the thought container.
  2. Extract thinking duration (e.g. `12s` or `5 seconds`) from the toggle header.
  3. Clone the main markdown node and **remove** the thought container so reasoning text does not duplicate inside the main response body.
  4. Store in `turn.thought = { text, html, duration }`.

---

### 3.5 LaTeX / KaTeX Mathematical Formulas

Gemini renders math formulas using KaTeX. The raw TeX source is stored inside MathML `<annotation>` tags:

```html
<span class="math-inline">
  <span class="katex">
    <span class="katex-mathml">
      <math>
        <semantics>
          <mrow>...</mrow>
          <annotation encoding="application/x-tex">E = mc^2</annotation>
        </semantics>
      </math>
    </span>
    <span class="katex-html" aria-hidden="true">...</span>
  </span>
</span>
```

**Extraction Strategy:**
1. Locate elements matching `.math-inline, .math-block, [data-math]`.
2. Extract TeX source from `annotation[encoding="application/x-tex"]` or `[data-tex]`.
3. If inline: replace node in clone with `$tex$` (single dollar signs).
4. If block (`div.math-block`): replace node in clone with `\n\n$$\n{tex}\n$$\n\n` (double dollar signs).

---

### 3.6 Code Blocks & Execution Outputs

- **Selectors:** `code-block`, `.code-block`, `pre:has(code)`.
- **Language Detection:**
  1. Attribute: `code-block[lang]`, `code-block[data-language]`.
  2. Header tag: `.code-lang`, `.code-block-header span`.
  3. Class name: `code[class*="language-"]` $\rightarrow$ `language-(\w+)`.
- **Execution Outputs:** Check for `.code-execution-output`, `.python-execution-cell`, or `.output-container`. Extract the stdout/table/image result and attach to the code block metadata.

---

### 3.7 Web Citations & Grounding Sources

- **Selectors:** `.grounding-card`, `.sources-container`, `a.citation-link`, `.source-chip`, `a[data-citation]`.
- **Extraction Strategy:**
  1. Collect all citation links with index number, anchor text / title, and destination `href`.
  2. Store in `turn.citations = [{ index, title, url, snippet }]`.
  3. Map in-text citation superscript markers (e.g. `[1]`, `<sup>1</sup>`) to corresponding citation footnotes.

---

### 3.8 Embedded Images & Media

- **Selectors:** `img` inside `model-response` or `user-query`.
- **Filter Out:** Avatars, UI icons, SVG buttons (`width < 32`, `src.includes('avatar')`, `src.includes('icon')`, `src.includes('googleusercontent.com/a/')`).
- **Processing:**
  1. Generate unique identifier `image-0`, `image-1`, etc.
  2. Fetch image via `fetch(img.src, { credentials: 'include' })` to obtain `Blob`.
  3. Read MIME type (`image/png`, `image/jpeg`, `image/webp`, `image/gif`).
  4. Convert to base64 Data URI.
  5. Replace DOM node `src` in clone with placeholder: `__IMAGE_PLACEHOLDER__image-N`.
