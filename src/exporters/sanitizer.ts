import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'pre', 'code',
  'blockquote',
  'a', 'img',
  'strong', 'b', 'em', 'i', 'u', 's', 'sup', 'sub'
];

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class', 'id', 'data-original-id', 'target', 'rel'];

/**
 * Sanitizes raw Gemini HTML before it is embedded into an export file
 * (HTML single/linked exports, and the DOCX HTML-to-docx walker).
 *
 * Uses an explicit tag/attribute allowlist rather than DOMPurify's full
 * default set: Gemini responses only ever need basic prose/table/code
 * markup plus `img`/`a`, so anything else (script, style, iframe, forms,
 * event handler attributes, style attributes, etc.) is dropped outright
 * instead of relying on us remembering to keep the defaults safe.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false
  });
}
