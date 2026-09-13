import DOMPurify from 'dompurify';

/**
 * Sanitizes raw Gemini HTML before it is embedded into an export file.
 *
 * Not yet wired into the exporters — see the `TODO milestone 3` markers in
 * htmlSingle.ts and htmlLinked.ts. Left as a stub so Milestone 3 can wire it
 * in without also having to pull in and configure DOMPurify from scratch.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html);
}
