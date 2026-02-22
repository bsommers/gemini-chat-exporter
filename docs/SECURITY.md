# Security Notes

This document covers security considerations for users, contributors, and anyone auditing the Gemini Chat Exporter Chrome extension.

---

## Architecture summary

```
Gemini tab (content.js)  →  Popup page (popup.js + exporters)  →  Local file download
```

No data ever leaves your machine through this extension. There are no analytics, no telemetry, no remote API calls, and no third-party services.

---

## What the extension can access

| Permission | Why it's needed |
|---|---|
| `activeTab` | Read the currently active Gemini tab |
| `scripting` | Inject `content.js` into tabs that were open before the extension loaded |
| `downloads` | Save exported files to your Downloads folder |
| `host_permissions: gemini.google.com/*` | Restrict content script injection to Gemini only |

The extension requests **no** access to browsing history, bookmarks, clipboard, cameras, microphones, geolocation, or other origins.

---

## Known risks and mitigations

### 1. Exported HTML files may reflect Gemini's raw HTML

**Risk:** Model responses are inserted into the exported `.html` file using the rendered HTML from Gemini's frontend. If a response ever contained unsanitised `<script>` tags or event-handler attributes (`onerror`, `onload`, etc.), they would be present in the exported file and execute when you open it in a browser.

**Context:** Gemini's own frontend sanitises AI responses before rendering them to the DOM, so this is unlikely in practice. However, the extension does not perform a second sanitisation pass.

**Mitigation advice:** If you plan to share exported HTML files with others, consider running them through a sanitiser such as [DOMPurify](https://github.com/cure53/DOMPurify) or opening them in a sandboxed browser profile. Markdown and DOCX exports are not affected by this risk.

---

### 2. Bundled vendor libraries are not integrity-verified at runtime

**Risk:** The extension bundles `turndown.min.js`, `jszip.min.js`, and `docx.min.js` directly in the repository. There is no Subresource Integrity (SRI) check applied to these files. If the files on disk were replaced by a malicious actor with local access to your machine, that code would run inside the extension popup.

**Mitigation advice:** This is a local-machine trust boundary issue. Verify the library files against known-good checksums if you are in a high-security environment:

| File | Source | Version |
|---|---|---|
| `lib/turndown.min.js` | [npmjs.com/package/turndown](https://www.npmjs.com/package/turndown) | 7.1.3 |
| `lib/jszip.min.js` | [npmjs.com/package/jszip](https://www.npmjs.com/package/jszip) | 3.10.1 |
| `lib/docx.min.js` | [npmjs.com/package/docx](https://www.npmjs.com/package/docx) | 8.5.0 |

---

### 3. Images are fetched with your session credentials

**Risk:** `content.js` fetches images embedded in Gemini responses using `fetch(src, { credentials: 'include' })`. This sends your Gemini session cookies along with the request, which is required to download private images that are not publicly accessible.

**Mitigation:** This fetch only runs for `src` URLs already present in the page DOM. The extension does not construct or request any URLs outside of what Gemini has already loaded. No credentials are stored or forwarded anywhere.

---

### 4. On-demand script injection

**Risk:** The extension uses `chrome.scripting.executeScript` to inject `content.js` into tabs that were already open before the extension was installed. This is a legitimate and standard Chrome extension pattern, but it does mean the popup can inject JavaScript into a Gemini tab on demand.

**Mitigation:** Injection is gated by `host_permissions`, which restricts this capability strictly to `https://gemini.google.com/*`. The injected file is `content.js`, which is bundled with the extension and visible in the source.

---

## Threat model

| Threat | In scope? | Notes |
|---|---|---|
| Extension exfiltrating your conversations | ✗ No | No external requests; all processing is local |
| Malicious content in exported HTML | ✓ Partial | See risk #1 above |
| Tampered vendor libraries | ✓ Possible | Physical/OS-level access required |
| Extension accessing non-Gemini sites | ✗ No | `host_permissions` restricts to Gemini only |
| Session token theft | ✗ No | Credentials only used inline for image fetch; not stored |

---

## Reporting a vulnerability

If you discover a security issue, please open a [GitHub Issue](https://github.com/bsommers/gemini-chat-exporter/issues) or contact the maintainer directly. Please avoid posting exploit details publicly until a fix is available.

---

## Advice for sensitive or enterprise use

- **Do not install** browser extensions in profiles that access sensitive corporate systems unless extensions have been reviewed and approved.
- Exported files (especially HTML and DOCX) may contain confidential information from your Gemini conversations. Handle them accordingly.
- Consider using a dedicated browser profile for AI chat tools.
- Review the full source code before installing — everything is in this repository with no build step required.
