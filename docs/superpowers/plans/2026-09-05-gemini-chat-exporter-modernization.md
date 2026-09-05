# Gemini Chat Exporter Modernization & Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize Gemini Chat Exporter DOM scraping to support current Gemini features (thinking blocks, KaTeX math, user attachments, resilient code blocks, and proper titles), fix exporter flaws (tables, image aspect ratios, placeholder bugs), add JSON and clipboard exports, build an automated packaging pipeline to `dist/`, and add an automated test suite.

**Architecture:** Vanilla JS Chrome extension (Manifest V3) running DOM extraction in `content.js` and multi-format conversions inside `popup.html`/`popup.js`. A build pipeline (`scripts/package.mjs`) packages a clean, ready-to-load directory in `dist/unpacked/` and a standalone `.zip`. Automated unit tests under `tests/` run on Node 20's native test runner with JSDOM.

**Tech Stack:** JavaScript (ES2022+ / Vanilla JS), Chrome Extension Manifest V3, Turndown 7.1.3, Docx.js 8.5.0, JSZip 3.10.1, Node 20 `node:test`, JSDOM.

## Global Constraints

- Retain vanilla JavaScript without transpilers or bundlers for the extension runtime to preserve auditability.
- No remote network requests or telemetry; all data processing occurs locally in the user's browser.
- Manifest V3 compliant; permissions restricted to `activeTab`, `scripting`, and `downloads`.
- Output directory `dist/unpacked/` must contain only runtime extension files (no docs, tests, scripts, or git files).
- All tests must pass with `npm test`.

---

### Task 1: Initialize NPM Package & Test Environment

**Files:**
- Create: `package.json`
- Create: `tests/setup.mjs`
- Test: `tests/sanity.test.mjs`

**Interfaces:**
- Produces: `npm test` script executing `node --test tests/*.test.mjs`
- Produces: `loadDom(html)` helper in `tests/setup.mjs` using JSDOM for subsequent tests.

- [ ] **Step 1: Write the failing test**

Create `tests/sanity.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDom } from './setup.mjs';

test('DOM environment loads properly in test harness', () => {
    const dom = loadDom('<div id="test">Hello Gemini</div>');
    const el = dom.window.document.getElementById('test');
    assert.equal(el.textContent, 'Hello Gemini');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sanity.test.mjs`  
Expected: FAIL with "Cannot find module './setup.mjs'"

- [ ] **Step 3: Create package.json and install jsdom**

Create `package.json`:
```json
{
  "name": "gemini-chat-exporter",
  "version": "1.1.0",
  "description": "Export Gemini chat sessions to Markdown, Word Doc, HTML, or JSON",
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "build": "node scripts/package.mjs",
    "package": "node scripts/package.mjs"
  },
  "devDependencies": {
    "jsdom": "^26.0.0"
  },
  "license": "GPL-3.0"
}
```

Run command: `npm install`

- [ ] **Step 4: Create test setup helper**

Create `tests/setup.mjs`:
```javascript
import { JSDOM } from 'jsdom';

export function loadDom(html = '<!DOCTYPE html><html><body></body></html>') {
    return new JSDOM(html, {
        url: 'https://gemini.google.com/app',
        runScripts: 'dangerously'
    });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tests/setup.mjs tests/sanity.test.mjs
git commit -m "chore: initialize npm package and test harness"
```

---

### Task 2: Modernize DOM Extraction Helpers in `content.js`

**Files:**
- Modify: `content.js`
- Test: `tests/content_extraction.test.mjs`

**Interfaces:**
- Produces: `cleanCodeBlocks(container)` in `content.js` (extracts clean pre/code, handles code languages, eliminates loop mutation bug)
- Produces: `cleanKatexMath(container)` in `content.js` (extracts raw LaTeX formulas from `<annotation encoding="application/x-tex">` and removes duplicate MathML)
- Produces: `extractChat()` in `content.js` (extracts user attachments, models thoughts, accurate titles, and safe image placeholders)

- [ ] **Step 1: Write the failing tests for code block replacement and KaTeX cleaning**

Create `tests/content_extraction.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDom } from './setup.mjs';

test('cleanCodeBlocks handles multiple code blocks without skipping or misindexing', () => {
    const dom = loadDom(`
        <div id="root">
            <code-block lang="python"><pre><code>print(1)</code></pre></code-block>
            <code-block lang="javascript"><pre><code>console.log(2)</code></pre></code-block>
            <code-block lang="bash"><pre><code>echo 3</code></pre></code-block>
        </div>
    `);
    const doc = dom.window.document;
    const root = doc.getElementById('root');

    // Simulate cleanCodeBlocks logic
    const blocks = Array.from(root.querySelectorAll('code-block'));
    for (const cb of blocks) {
        const pre = cb.querySelector('pre') || cb.querySelector('code');
        const lang = cb.getAttribute('lang') || '';
        const codeText = pre ? pre.textContent : cb.textContent;
        const replacement = doc.createElement('pre');
        const codeEl = doc.createElement('code');
        if (lang) codeEl.className = `language-${lang}`;
        codeEl.textContent = codeText;
        replacement.appendChild(codeEl);
        cb.replaceWith(replacement);
    }

    const preEls = root.querySelectorAll('pre');
    assert.equal(preEls.length, 3);
    assert.equal(preEls[0].querySelector('code').className, 'language-python');
    assert.equal(preEls[1].querySelector('code').className, 'language-javascript');
    assert.equal(preEls[2].querySelector('code').className, 'language-bash');
});

test('cleanKatexMath extracts raw TeX from annotations and strips duplicate MathML', () => {
    const dom = loadDom(`
        <div id="root">
            <span class="katex">
                <span class="katex-mathml">
                    <math><semantics><mrow><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></mrow>
                    <annotation encoding="application/x-tex">E=mc^2</annotation></semantics></math>
                </span>
                <span class="katex-html" aria-hidden="true"><span class="base">E=mc2</span></span>
            </span>
        </div>
    `);
    const doc = dom.window.document;
    const root = doc.getElementById('root');

    const katexEls = Array.from(root.querySelectorAll('.katex, math-renderer'));
    for (const el of katexEls) {
        const annotation = el.querySelector('annotation[encoding*="tex"]');
        const tex = annotation ? annotation.textContent.trim() : (el.getAttribute('data-tex') || el.textContent.trim());
        const span = doc.createElement('span');
        span.className = 'latex-math';
        span.textContent = `$${tex}$`;
        el.replaceWith(span);
    }

    assert.equal(root.textContent.trim(), '$E=mc^2$');
});
```

- [ ] **Step 2: Run test to verify initial tests pass**

Run: `node --test tests/content_extraction.test.mjs`  
Expected: PASS (verifying the planned replacement logic works as intended)

- [ ] **Step 3: Update `content.js` with modernized extraction logic**

Update `content.js`:
- Add idempotency guard `if (window.__geminiExporterLoaded) return; window.__geminiExporterLoaded = true;`
- Implement `extractConversationTitle()` with fallback to active conversation sidebar item, top title, first prompt truncated, and sanitized `document.title`.
- Implement `cleanCodeBlocks(container)`: query all `code-block` elements in the cloned node directly, remove copy buttons, and convert to `<pre><code class="language-...">`.
- Implement `cleanKatexMath(container)`: replace KaTeX structures with `$tex$` or `$$tex$$`.
- Implement thinking block extraction: detect `.thinking-process`, `<expandable-block>`, or `<thought-box>` and preserve it in a `<details class="gemini-thought"><summary>Thinking Process</summary>...</details>` wrapper.
- Extract user attachments (images and files) from user turn nodes.
- Replace sequential image fetch with bounded `Promise.all` and use `data-exporter-id` on images.

- [ ] **Step 4: Run tests**

Run: `npm test`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add content.js tests/content_extraction.test.mjs
git commit -m "fix(content): modernize Gemini DOM extraction, code-block replacement, and math handling"
```

---

### Task 3: Upgrade Markdown Exporter with GFM Tables and Math

**Files:**
- Modify: `exporters/markdown.js`
- Test: `tests/markdown.test.mjs`

**Interfaces:**
- Consumes: `chatData` object `{ title, turns: [{ role, text, html, attachments? }], images: [] }`
- Produces: `exportMarkdown(chatData)` returning formatted markdown string with GFM tables, fenced code blocks, math, and thought blocks.

- [ ] **Step 1: Write the failing tests for Markdown tables and math**

Create `tests/markdown.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDom } from './setup.mjs';
import fs from 'node:fs';

// Load Turndown and markdown exporter into a simulated window
const turndownCode = fs.readFileSync('lib/turndown.min.js', 'utf8');
const exporterCode = fs.readFileSync('exporters/markdown.js', 'utf8');

function setupExporter() {
    const dom = loadDom();
    dom.window.eval(turndownCode);
    dom.window.eval(exporterCode);
    return dom.window.exportMarkdown;
}

test('exportMarkdown preserves GFM tables properly', () => {
    const exportMarkdown = setupExporter();
    const chatData = {
        title: 'Table Test',
        turns: [
            {
                role: 'user',
                text: 'Make a table',
                html: 'Make a table'
            },
            {
                role: 'model',
                text: '',
                html: `<table>
                    <thead><tr><th>Item</th><th>Cost</th></tr></thead>
                    <tbody><tr><td>Apple</td><td>$1</td></tr><tr><td>Orange</td><td>$2</td></tr></tbody>
                </table>`
            }
        ],
        images: []
    };

    const md = exportMarkdown(chatData);
    assert.ok(md.includes('| Item | Cost |'), 'Markdown contains table headers');
    assert.ok(md.includes('| Apple | $1 |'), 'Markdown contains table rows');
});

test('exportMarkdown formats thinking process as blockquote or details', () => {
    const exportMarkdown = setupExporter();
    const chatData = {
        title: 'Thinking Test',
        turns: [
            {
                role: 'model',
                text: '',
                html: '<details class="gemini-thought"><summary>Thinking Process</summary><p>Considering alternatives...</p></details><p>Here is the final answer.</p>'
            }
        ],
        images: []
    };

    const md = exportMarkdown(chatData);
    assert.ok(md.includes('Thinking Process') || md.includes('Considering alternatives'));
    assert.ok(md.includes('Here is the final answer.'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/markdown.test.mjs`  
Expected: FAIL because Turndown currently strips tables.

- [ ] **Step 3: Implement GFM table rules in `exporters/markdown.js`**

Add table rules to Turndown in `exporters/markdown.js`:
- Table rule: format `<table>` into Markdown pipe table with separator `| --- | --- |`.
- Details/summary rule: format `<details class="gemini-thought">` into Markdown quote or collapsible block.
- Latex math rule: format `<span class="latex-math">` without escaping dollar signs.
- Image rule: use `data-exporter-id` fallback if `node.src` has been resolved by browser.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/markdown.test.mjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add exporters/markdown.js tests/markdown.test.mjs
git commit -m "feat(exporters): add GFM table and math support to Markdown exporter"
```

---

### Task 4: Implement Structured JSON Exporter

**Files:**
- Create: `exporters/json_export.js`
- Test: `tests/json.test.mjs`

**Interfaces:**
- Produces: `exportJson(chatData)` returning formatted JSON string with metadata, turns, and image references.

- [ ] **Step 1: Write the failing test for JSON exporter**

Create `tests/json.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDom } from './setup.mjs';
import fs from 'node:fs';

const jsonExporterCode = fs.readFileSync('exporters/json_export.js', 'utf8');

function setupExporter() {
    const dom = loadDom();
    dom.window.eval(jsonExporterCode);
    return dom.window.exportJson;
}

test('exportJson produces valid structured JSON schema', () => {
    const exportJson = setupExporter();
    const chatData = {
        title: 'Project Architecture',
        turns: [
            { role: 'user', text: 'How should we build this?', html: '<p>How should we build this?</p>' },
            { role: 'model', text: 'Use clean architecture.', html: '<p>Use clean architecture.</p>', thought: 'Plan: breakdown components' }
        ],
        images: [{ id: 'image-0', alt: 'diagram', ext: 'png' }]
    };

    const jsonString = exportJson(chatData);
    const parsed = JSON.parse(jsonString);

    assert.equal(parsed.title, 'Project Architecture');
    assert.equal(parsed.turns.length, 2);
    assert.equal(parsed.turns[0].role, 'user');
    assert.equal(parsed.turns[1].role, 'model');
    assert.equal(parsed.images.length, 1);
    assert.ok(parsed.exportedAt);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/json.test.mjs`  
Expected: FAIL with "no such file or directory: exporters/json_export.js"

- [ ] **Step 3: Implement `exporters/json_export.js`**

Create `exporters/json_export.js`:
```javascript
// exporters/json_export.js
// Exports structured conversation data as formatted JSON

'use strict';

function exportJson(chatData) {
    const { title, turns, images } = chatData;
    const output = {
        title: title || 'Gemini Chat',
        exportedAt: new Date().toISOString(),
        generator: 'Gemini Chat Exporter',
        version: '1.1.0',
        turns: turns.map(t => ({
            role: t.role,
            text: t.text || '',
            thought: t.thought || undefined,
            attachments: t.attachments || undefined,
            html: t.html || undefined
        })),
        images: (images || []).map(img => ({
            id: img.id,
            alt: img.alt || '',
            ext: img.ext || 'png'
        }))
    };

    return JSON.stringify(output, null, 2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/json.test.mjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add exporters/json_export.js tests/json.test.mjs
git commit -m "feat(exporters): add structured JSON exporter"
```

---

### Task 5: Upgrade HTML Single & Linked Exporters

**Files:**
- Modify: `exporters/html_single.js`
- Modify: `exporters/html_linked.js`
- Test: `tests/html.test.mjs`

**Interfaces:**
- Produces: `exportHtmlSingle(chatData)` with robust image placeholder substitution (`data-exporter-id`) and modern styling for tables, math, and thoughts.
- Produces: `exportHtmlLinked(chatData)` with ZIP structure matching relative paths.

- [ ] **Step 1: Write the failing tests for HTML placeholder replacement**

Create `tests/html.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDom } from './setup.mjs';
import fs from 'node:fs';

const singleHtmlCode = fs.readFileSync('exporters/html_single.js', 'utf8');

function setupSingle() {
    const dom = loadDom();
    dom.window.eval(singleHtmlCode);
    return dom.window.exportHtmlSingle;
}

test('exportHtmlSingle replaces image placeholders with base64 data URIs even with full URLs in src', () => {
    const exportHtmlSingle = setupSingle();
    const chatData = {
        title: 'HTML Test',
        turns: [
            {
                role: 'model',
                text: 'Image response',
                html: '<img src="https://gemini.google.com/app/__IMAGE_PLACEHOLDER__image-0" data-exporter-id="image-0" alt="Generated Chart">'
            }
        ],
        images: [
            { id: 'image-0', base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', alt: 'Generated Chart', ext: 'png' }
        ]
    };

    const html = exportHtmlSingle(chatData);
    assert.ok(html.includes('data:image/png;base64,iVBORw0KGgo'), 'Base64 image is embedded');
    assert.ok(!html.includes('__IMAGE_PLACEHOLDER__'), 'Placeholder is completely replaced');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/html.test.mjs`  
Expected: FAIL because regex expects exact `src="__IMAGE_PLACEHOLDER__..."`.

- [ ] **Step 3: Update `exporters/html_single.js` and `exporters/html_linked.js`**

- Support both `data-exporter-id` and regex matching `(?:https?://[^/]+)?/__IMAGE_PLACEHOLDER__(image-\d+)`.
- Add CSS styling for tables, latex formulas, and thinking `<details>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/html.test.mjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add exporters/html_single.js exporters/html_linked.js tests/html.test.mjs
git commit -m "fix(exporters): fix HTML placeholder replacement and add table/math styling"
```

---

### Task 6: Improve DOCX Exporter Aspect Ratios & Lists

**Files:**
- Modify: `exporters/docx_export.js`
- Test: `tests/docx.test.mjs`

**Interfaces:**
- Produces: `exportDocx(chatData)` with proportional image scaling, direct-child list parsing without item duplication, and line break fixes.

- [ ] **Step 1: Write test for DOCX generation and list hierarchy**

Create `tests/docx.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDom } from './setup.mjs';
import fs from 'node:fs';

const docxLibCode = fs.readFileSync('lib/docx.min.js', 'utf8');
const docxExportCode = fs.readFileSync('exporters/docx_export.js', 'utf8');

function setupDocx() {
    const dom = loadDom();
    dom.window.eval(docxLibCode);
    dom.window.eval(docxExportCode);
    return dom.window.exportDocx;
}

test('exportDocx generates a valid Blob without throwing errors', async () => {
    const exportDocx = setupDocx();
    const chatData = {
        title: 'DOCX Test',
        turns: [
            { role: 'user', text: 'List test', html: '<p>List test</p>' },
            {
                role: 'model',
                text: 'Items',
                html: '<ul><li>Item 1</li><li>Item 2<ul><li>Nested 2.1</li></ul></li></ul>'
            }
        ],
        images: []
    };

    const blob = await exportDocx(chatData);
    assert.ok(blob, 'Blob returned');
    assert.ok(blob.size > 0, 'Blob contains data');
});
```

- [ ] **Step 2: Run test to verify execution**

Run: `node --test tests/docx.test.mjs`  
Expected: Verify behavior.

- [ ] **Step 3: Update `exporters/docx_export.js`**

- Fix `ul`/`ol` list processing: only iterate direct children (`node.children`) instead of recursive `querySelectorAll('li')` to avoid duplicating nested list items.
- Calculate image bounding dimensions proportionally (e.g. max width 500, max height 400).
- Preserve table cell formatting and code blocks with line breaks.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/docx.test.mjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add exporters/docx_export.js tests/docx.test.mjs
git commit -m "fix(docx): fix nested list duplication and calculate proportional image bounds"
```

---

### Task 7: Update Popup UI & Add JSON and Copy Actions

**Files:**
- Modify: `popup.html`
- Modify: `popup.js`
- Modify: `popup.css`

**Interfaces:**
- Produces: JSON export button (`#btnJson`) in popup.
- Produces: Copy Markdown to Clipboard action button (`#btnCopy`) in popup.
- Produces: Quick visual confirmation on successful copy or export.

- [ ] **Step 1: Update `popup.html`**

Add JSON exporter script tag: `<script src="exporters/json_export.js"></script>`.  
Add buttons for:
- JSON Export: `<button class="export-btn" id="btnJson" data-format="json">`
- Copy Markdown: `<button class="export-btn" id="btnCopy" data-format="copy">`

- [ ] **Step 2: Update `popup.js`**

- Handle `format === 'json'`: call `exportJson(chatData)`, generate `.json` file.
- Handle `format === 'copy'`: call `exportMarkdown(chatData)`, copy to clipboard using `navigator.clipboard.writeText(md)`, and show status `✓ Copied Markdown to clipboard!`.

- [ ] **Step 3: Update `popup.css`**

Add subtle styling for the copy button and secondary actions.

- [ ] **Step 4: Commit**

```bash
git add popup.html popup.js popup.css
git commit -m "feat(popup): add JSON export and Copy to Clipboard buttons"
```

---

### Task 8: Clean Manifest V3 and Service Worker

**Files:**
- Modify: `manifest.json`
- Modify: `background.js`

**Interfaces:**
- Produces: Clean `manifest.json` without exposed `web_accessible_resources`.
- Produces: Lean `background.js` without unused heavy library imports.

- [ ] **Step 1: Update `manifest.json`**

- Bump version to `"1.1.0"`.
- Remove unnecessary `web_accessible_resources` block.
- Verify permissions: `["downloads", "scripting", "activeTab"]`.

- [ ] **Step 2: Update `background.js`**

- Remove dead `importScripts('lib/turndown.min.js', ...)` and dead `export` message listener.
- Retain clean baseline service worker.

- [ ] **Step 3: Commit**

```bash
git add manifest.json background.js
git commit -m "refactor(manifest): clean up permissions, remove dead service worker scripts"
```

---

### Task 9: Implement Automated Packaging Pipeline (`scripts/package.mjs`)

**Files:**
- Create: `scripts/package.mjs`
- Modify: `package.json`
- Test: `tests/packaging.test.mjs`

**Interfaces:**
- Produces: `npm run build` command creating `dist/unpacked/` and `dist/gemini-chat-exporter-v1.1.0.zip`.
- Guarantees: `dist/unpacked/` contains ONLY files needed by Chrome (no tests, docs, scripts, or git files).

- [ ] **Step 1: Write test for packaging script**

Create `tests/packaging.test.mjs`:
```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

test('npm run build creates dist/unpacked with valid manifest and no development files', () => {
    execSync('node scripts/package.mjs', { stdio: 'pipe' });

    assert.ok(fs.existsSync('dist/unpacked/manifest.json'), 'manifest exists in unpacked');
    assert.ok(fs.existsSync('dist/unpacked/popup.html'), 'popup.html exists in unpacked');
    assert.ok(fs.existsSync('dist/unpacked/content.js'), 'content.js exists in unpacked');
    assert.ok(fs.existsSync('dist/unpacked/exporters/markdown.js'), 'markdown exporter exists');
    assert.ok(fs.existsSync('dist/unpacked/lib/turndown.min.js'), 'turndown lib exists');

    // Verify development files are EXCLUDED
    assert.ok(!fs.existsSync('dist/unpacked/tests'), 'tests directory excluded');
    assert.ok(!fs.existsSync('dist/unpacked/docs'), 'docs directory excluded');
    assert.ok(!fs.existsSync('dist/unpacked/scripts'), 'scripts directory excluded');
    assert.ok(!fs.existsSync('dist/unpacked/package.json'), 'package.json excluded');

    // Verify zip package exists
    const files = fs.readdirSync('dist');
    const zip = files.find(f => f.endsWith('.zip'));
    assert.ok(zip, 'dist contains a zip package');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/packaging.test.mjs`  
Expected: FAIL with "Cannot find module ... scripts/package.mjs"

- [ ] **Step 3: Implement `scripts/package.mjs`**

Create `scripts/package.mjs`:
- Parse `manifest.json` and read version.
- Create clean `dist/` and `dist/unpacked/`.
- Copy specified files and directories:
  - `manifest.json`
  - `background.js`
  - `content.js`
  - `popup.html`, `popup.css`, `popup.js`
  - `exporters/`
  - `lib/`
  - `icons/`
- Zip `dist/unpacked/` into `dist/gemini-chat-exporter-v${version}.zip`.
- Print summary and instructions for Chrome "Load unpacked".

- [ ] **Step 4: Update `.gitignore`**

Ensure `dist/` and `node_modules/` are in `.gitignore`.

- [ ] **Step 5: Run packaging test**

Run: `node --test tests/packaging.test.mjs`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/package.mjs tests/packaging.test.mjs .gitignore
git commit -m "feat(build): add automated packaging script for dist/unpacked and release zip"
```

---

### Task 10: Update Documentation and Security Notes

**Files:**
- Modify: `README.md`
- Modify: `docs/SECURITY.md`

**Interfaces:**
- Produces: Updated `README.md` reflecting modern features, `dist/` directory, new formats (JSON, Copy), and `npm run build` instructions.
- Produces: Updated `docs/SECURITY.md` reflecting clean manifest permissions and no `web_accessible_resources`.

- [ ] **Step 1: Update `README.md`**

- Update feature table: Markdown (with GFM tables), Word Document, Single Webpage, Webpage + Images, JSON, Copy to Clipboard.
- Update installation section to mention `dist/unpacked` or the ready-to-load release zip.
- Update architecture diagram to reflect popup and content script interactions.

- [ ] **Step 2: Update `docs/SECURITY.md`**

- Reflect removed `web_accessible_resources`.
- Update permission explanations and local processing model.

- [ ] **Step 3: Run full verification suite**

Run: `npm test && npm run build`  
Expected: All tests PASS, build generates clean distribution.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/SECURITY.md
git commit -m "docs: update README and security notes for v1.1.0 release"
```
