# Extension Packaging & Publishing Guide

## 1. Overview & Packaging Philosophy

A core requirement of `gemini-chat-exporter` is strict separation of concerns:
- **`src/` (Development Source):** TypeScript source code, unit tests, and tooling configurations.
- **`dist/` (Distribution Output):** The pure, standalone unpacked extension directory. It contains **only** production-ready assets (`manifest.json`, bundled `.js`, `.html`, `.css`, and `icons/`). It contains zero source files (`.ts`), zero test files, zero configs (`vite.config.ts`, `package.json`), and zero `node_modules`.
- **`release/` (Store Artifacts):** Clean `.zip` archives containing the contents of `dist/` ready for upload to the Chrome Web Store Developer Dashboard.

---

## 2. Build Pipeline & Commands

### 2.1 Available NPM Scripts

```json
{
  "scripts": {
    "dev": "vite build --watch --mode development",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "package": "npm run build && npm test && node scripts/package.js",
    "clean": "rimraf dist release coverage"
  }
}
```

### 2.2 Build Execution (`npm run build`)
1. Executes `tsc --noEmit` to verify type safety across all TypeScript modules.
2. Invokes Vite with custom multi-entry rollup options:
   - Compiles `src/background/index.ts` $\rightarrow$ `dist/background.js`.
   - Compiles `src/content/index.ts` $\rightarrow$ `dist/content.js`.
   - Compiles `src/popup/popup.html` $\rightarrow$ `dist/popup.html`, `dist/popup.js`, `dist/popup.css`.
   - Bundles all external libraries (`turndown`, `turndown-plugin-gfm`, `docx`, `jszip`, `dompurify`) directly into their respective bundles.
   - Copies `manifest.json` and `icons/` into `dist/`.

---

## 3. Loading Unpacked Extension in Chrome

1. Build the production extension:
   ```bash
   npm run build
   ```
2. Open Google Chrome and navigate to:
   ```
   chrome://extensions
   ```
3. Enable **Developer mode** via the toggle switch in the top-right corner.
4. Click **Load unpacked** in the top-left toolbar.
5. Select the `dist/` folder inside the `gemini-chat-exporter` directory.
6. The **Gemini Chat Exporter** extension icon will now appear in your browser extensions menu.

---

## 4. Packaging for the Chrome Web Store (`npm run package`)

To create an official upload archive for the Chrome Web Store:

```bash
npm run package
```

The script performs the following automated verification steps:
1. Runs full test suite (`npm test`) including build verification tests.
2. Creates `release/gemini-chat-exporter-vX.Y.Z.zip` containing strictly the files inside `dist/`.
3. Verifies that the archive excludes `.git`, `node_modules`, `.env`, markdown documentation, and test fixtures.

---

## 5. Chrome Web Store Submission Checklist

- [ ] `manifest_version` is set to `3`.
- [ ] Name, description, and version in `manifest.json` match `CHROMEWEBSTORE.md`.
- [ ] All icon files (`16x16`, `48x48`, `128x128`) exist and are valid PNG images.
- [ ] No `eval()`, inline scripts, or remote code execution present in any file.
- [ ] Permissions (`downloads`, `scripting`, `activeTab`, `tabs`) are each justified in `CHROMEWEBSTORE.md`.
- [ ] Host permissions are strictly restricted to `https://gemini.google.com/*`.
- [ ] The ZIP archive contains only root files from `dist/` (manifest.json at archive root).
