# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v1.1.0] - 2026-10-01

### Added
- **TypeScript & Vite Build Pipeline**: Automated multi-entry build pipeline compiling background service workers, content scripts, and popup UI into optimized IIFE bundles.
- **Modular Scraper Architecture**:
  - Deep reasoning and thinking trace extraction (`<thought-box>`) with duration metadata.
  - KaTeX LaTeX mathematical formula parsing for inline `$formula$` and block `$$formula$$`.
  - Code block normalization with language tags and Python execution outputs.
  - Multimodal user attachment scraping (uploaded images and documents).
  - Grounding cards, citations, and source references.
  - Concurrent session-credentialed image fetching and base64 encoding.
- **Exporters**:
  - Markdown exporter with Turndown, GFM tables, and math formatting.
  - Microsoft Word (`.docx`) exporter with proportional image scaling.
  - Single standalone HTML exporter with embedded base64 assets and dark mode support.
  - HTML + Images linked ZIP archive exporter (`JSZip`).
  - Structured JSON data exporter.
  - One-click "Copy to Clipboard" action in popup UI.
- **Security & Privacy**:
  - Defense-in-depth HTML sanitization with `DOMPurify`.
  - Zero external network requests or telemetry.
  - Least-privilege Manifest V3 permissions.
- **Comprehensive Automated Test Suite**: 116 unit and integration test cases across scrapers, exporters, sanitizers, and popup controllers using Vitest and JSDOM.

### Changed
- Modernized extension architecture from legacy scripts to modular TypeScript.
- Enhanced popup UI with responsive feedback, format triggers, and title detection.

### Fixed
- Fixed KaTeX delimiter formatting in Markdown exports.
- Resolved nested list duplication and image bounding calculation in DOCX generator.
- Prevented reasoning summary text duplication in thinking block outputs.
