import type { Citation, Thought } from '../content/types';

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Shared HTML fragment builders used by both htmlSingle.ts and htmlLinked.ts
 * so the two near-duplicate exporters render thoughts/citations identically.
 */
export function renderThoughtHtml(thought: Thought, sanitize: (html: string) => string): string {
  const summary = thought.duration ? `Thinking Process (${thought.duration})` : 'Thinking Process';
  const body = thought.html ? sanitize(thought.html) : `<p>${escapeHtml(thought.text)}</p>`;
  return `
        <details class="thought-details">
          <summary class="thought-summary">${escapeHtml(summary)}</summary>
          <div class="thought-body">${body}</div>
        </details>`;
}

export function renderCitationsHtml(citations: Citation[]): string {
  const items = citations
    .map((c, i) => {
      const label = escapeHtml(c.index ?? String(i + 1));
      const title = escapeHtml(c.title || c.url);
      const href = escapeHtml(c.url);
      const snippet = c.snippet ? `<span class="citation-snippet">${escapeHtml(c.snippet)}</span>` : '';
      return `<li><span class="citation-index">[${label}]</span> <a class="citation-link" href="${href}" target="_blank" rel="noopener noreferrer">${title}</a>${snippet}</li>`;
    })
    .join('\n          ');

  return `
        <ul class="citations">
          ${items}
        </ul>`;
}
