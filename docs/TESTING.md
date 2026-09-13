# Testing Strategy & Test Guide

## 1. Testing Philosophy & Objectives

The testing suite for `gemini-chat-exporter` is designed to guarantee:
1. **Scraper Resilience:** Robust DOM extraction across diverse and changing Gemini UI layouts.
2. **Exporter Fidelity:** Exact document formatting across Markdown, Word (.docx), Single HTML, ZIP, and JSON.
3. **Security Assurance:** 100% neutralization of XSS injection vectors in exported HTML files.
4. **Chrome API Isolation:** Fast, deterministic testing of extension workflows via lightweight Chrome API mocks without needing a live browser instance.
5. **Packaging Cleanliness:** Verification that production builds (`dist/`) are free from test artifacts, source files, and Manifest V3 violations.

---

## 2. Test Architecture & Directory Structure

```
tests/
├── unit/
│   ├── content/
│   │   ├── extractor.test.ts          # End-to-end DOM extractor orchestrator
│   │   ├── userTurn.test.ts           # User prompt & multimodal attachment tests
│   │   ├── modelTurn.test.ts          # Model response parser tests
│   │   ├── thoughtScraper.test.ts     # Deep reasoning trace extraction
│   │   ├── mathScraper.test.ts        # LaTeX / KaTeX equation parser
│   │   ├── codeScraper.test.ts        # Code blocks & Python execution cells
│   │   ├── citationScraper.test.ts    # Web search grounding & source chips
│   │   └── imageScraper.test.ts       # Image base64 encoding & placeholder mapping
│   ├── exporters/
│   │   ├── markdown.test.ts           # Markdown GFM tables, math, thoughts, fences
│   │   ├── docx.test.ts               # Word .docx paragraph, table, run structure
│   │   ├── htmlSingle.test.ts         # Single-file HTML, base64 images, themes
│   │   ├── htmlLinked.test.ts         # ZIP archive, relative paths, styles.css
│   │   └── json.test.ts               # Structured JSON export & schema validation
│   ├── security/
│   │   └── sanitizer.test.ts          # DOMPurify XSS payload neutralization
│   └── popup/
│       └── popupController.test.ts    # UI state, title resolution, button actions
├── fixtures/                          # Real Gemini HTML DOM snapshots
│   ├── basicChat.html
│   ├── thinkingProcess.html
│   ├── codeAndExecution.html
│   ├── mathKatex.html
│   ├── groundingCitations.html
│   └── multimodalUserUpload.html
├── mocks/
│   └── chrome.ts                      # Full mock for chrome.tabs, scripting, downloads, runtime
└── integration/
    ├── messagePassing.test.ts         # Popup <-> Content script communication
    └── buildVerification.test.ts      # Validates dist/ cleanliness & Manifest V3
```

---

## 3. Test Runner & Environment Configuration

The test suite runs on **Vitest** with a **JSDOM** environment for instant headless DOM simulation.

### `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/mocks/chrome.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts']
    }
  }
});
```

---

## 4. Test Categories

### 4.1 Scraper Unit Tests with Real DOM Fixtures
Fixtures in `tests/fixtures/` store sanitized snapshots of actual Gemini conversation turns.

```typescript
// Example: tests/unit/content/thoughtScraper.test.ts
import { describe, it, expect } from 'vitest';
import { extractThought } from '../../../src/content/scrapers/thoughtScraper';

describe('thoughtScraper', () => {
  it('extracts thinking process and duration from thought container', () => {
    document.body.innerHTML = `
      <div class="thought-container">
        <button class="thought-toggle">Thinking Process (14s)</button>
        <div class="thought-content">
          <p>Analyzing quantum mechanical states...</p>
        </div>
      </div>
    `;

    const modelNode = document.body;
    const thought = extractThought(modelNode);

    expect(thought).toBeDefined();
    expect(thought?.duration).toBe('14s');
    expect(thought?.text).toContain('Analyzing quantum mechanical states');
  });
});
```

---

### 4.2 Exporter Unit Tests

```typescript
// Example: tests/unit/exporters/markdown.test.ts
import { describe, it, expect } from 'vitest';
import { exportMarkdown } from '../../../src/exporters/markdown';
import { ChatData } from '../../../src/content/types';

describe('Markdown Exporter', () => {
  it('formats tables, math equations, and thinking blocks correctly', () => {
    const mockChat: ChatData = {
      title: 'Quantum Test',
      exportedAt: '2026-08-27T16:00:00Z',
      turns: [
        {
          id: 'turn-0',
          role: 'user',
          text: 'What is the equation for energy?',
          html: '<p>What is the equation for energy?</p>'
        },
        {
          id: 'turn-1',
          role: 'model',
          text: 'Energy equation:\n$$E=mc^2$$',
          html: '<p>Energy equation:</p><p class="math-block">$$E=mc^2$$</p>',
          thought: {
            text: 'Recalling Einstein mass-energy equivalence...',
            html: '<p>Recalling Einstein mass-energy equivalence...</p>',
            duration: '4s'
          }
        }
      ],
      images: []
    };

    const output = exportMarkdown(mockChat);

    expect(output).toContain('# Quantum Test');
    expect(output).toContain('## 👤 You');
    expect(output).toContain('## 🤖 Gemini');
    expect(output).toContain('> [!NOTE]');
    expect(output).toContain('**Thinking Process (4s)**');
    expect(output).toContain('$$E=mc^2$$');
  });
});
```

---

### 4.3 Security & XSS Sanitization Tests

```typescript
// Example: tests/unit/security/sanitizer.test.ts
import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../../src/exporters/sanitizer';

describe('HTML Sanitizer', () => {
  it('removes script tags and event handlers from model HTML', () => {
    const maliciousHtml = `
      <p>Legitimate text</p>
      <script>alert("pwned")</script>
      <img src="valid.png" onerror="alert('xss')" />
      <a href="javascript:void(0)">Click me</a>
    `;

    const sanitized = sanitizeHtml(maliciousHtml);

    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).toContain('Legitimate text');
    expect(sanitized).toContain('<img src="valid.png"');
  });
});
```

---

### 4.4 Build & Packaging Verification Tests

Ensures the output in `dist/` satisfies all Chrome Web Store and Manifest V3 criteria:

```typescript
// Example: tests/integration/buildVerification.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Build Packaging Verification', () => {
  const distDir = path.resolve(__dirname, '../../dist');

  it('contains valid manifest.json with Manifest V3', () => {
    const manifestPath = path.join(distDir, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe('Gemini Chat Exporter');
    expect(manifest.permissions).toContain('downloads');
    expect(manifest.permissions).toContain('scripting');
  });

  it('all referenced icon files exist as valid files', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(distDir, 'manifest.json'), 'utf8'));
    for (const size of ['16', '48', '128']) {
      const iconRelPath = manifest.icons[size];
      expect(fs.existsSync(path.join(distDir, iconRelPath))).toBe(true);
    }
  });

  it('does not contain test files, source files, or node_modules', () => {
    const files = fs.readdirSync(distDir, { recursive: true }) as string[];
    expect(files.some(f => f.includes('.test.'))).toBe(false);
    expect(files.some(f => f.includes('.ts'))).toBe(false);
    expect(files.some(f => f.includes('node_modules'))).toBe(false);
  });
});
```

---

## 5. Running Tests

```bash
# Run all unit and integration tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Generate code coverage report
npm run test:coverage
```
