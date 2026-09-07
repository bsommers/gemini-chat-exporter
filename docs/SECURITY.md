# Security Notes

This document covers security considerations for users, contributors, and anyone auditing the Gemini Chat Exporter Chrome extension.

---

## Architecture Summary

```
Gemini tab (content.js)  →  Popup page (popup.js + exporters)  →  Local file download / clipboard
```

**Zero external communication:**
No data ever leaves your machine. There are no analytics, no telemetry, no tracking pixels, no remote API calls, and no third-party servers. All DOM scraping, formatting conversions, and archiving happen locally in your browser session.

---

## Permissions Breakdown

| Permission | Why it's needed | Scope & Restrictions |
|---|---|---|
| `activeTab` | Read the active tab when the user clicks the extension icon | Temporary access granted only on explicit user click |
| `scripting` | Inject `content.js` into tabs that were open before extension installation | Strictly restricted by `host_permissions` to `https://gemini.google.com/*` |
| `downloads` | Save exported files (.md, .docx, .html, .zip, .json) to your computer | Local filesystem only via Chrome's download API |
| `host_permissions: https://gemini.google.com/*` | Constrains content script execution to Gemini only | Cannot run on any other domain or web origin |

The extension requests **no** access to browsing history, bookmarks, storage, web requests, cookies outside Gemini session fetching, cameras, microphones, geolocation, or arbitrary origins.

---

## Hardening in v1.1.0

1. **Elimination of `web_accessible_resources`:**
   Previous versions exposed vendored libraries (`lib/*`) and exporters (`exporters/*`) to web page contexts via `web_accessible_resources`. In v1.1.0, this block has been completely removed. Extension internal scripts are strictly quarantined within the extension popup and background service worker.

2. **Idempotent Injection Guard:**
   `content.js` enforces `window.__geminiExporterLoaded` guards to prevent duplicate execution or memory leaks if script injection is triggered multiple times.

3. **Restricted Clipboard Writing:**
   The "Copy to Clipboard" feature uses standard `navigator.clipboard.writeText()` directly triggered by user click events. No clipboard reading permissions are requested or used.

---

## Known Risks and Mitigations

### 1. Exported HTML Reflects Rendered Gemini DOM

**Risk:** Model responses in HTML exports contain the rendered HTML produced by Gemini's web application. If a response contained unsanitised script tags or inline handlers, opening the exported file could execute them.

**Mitigation:** Gemini's frontend sanitises AI responses before inserting them into the DOM. Markdown, JSON, and DOCX exports convert or strip raw HTML constructs and are not affected by this risk.

### 2. Vendored Libraries

**Risk:** Vendor libraries (`turndown.min.js`, `jszip.min.js`, `docx.min.js`) are bundled locally to avoid any external runtime network dependencies.

**Verification:**
| File | Package | Version |
|---|---|---|
| `lib/turndown.min.js` | `turndown` | 7.1.3 |
| `lib/jszip.min.js` | `jszip` | 3.10.1 |
| `lib/docx.min.js` | `docx` | 8.5.0 |

---

## Threat Model

| Threat | In scope? | Status & Mitigation |
|---|---|---|
| Data exfiltration | ✗ No | Zero external requests; 100% local processing |
| Cross-site script injection | ✗ No | `host_permissions` restricts content script to `gemini.google.com` |
| Web page inspection of extension code | ✗ No | `web_accessible_resources` removed |
| Token / credential theft | ✗ No | No tokens or passwords read, stored, or forwarded |

---

## Reporting a Vulnerability

If you discover a security vulnerability, please open an issue or contact the maintainers directly.
