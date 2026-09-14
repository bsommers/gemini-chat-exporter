import { describe, it, expect } from 'vitest';
import { scrapeCitations } from '../../../src/content/scrapers/citationScraper';

describe('scrapeCitations', () => {
  it('collects citation index, title, url, and snippet from a grounding card', () => {
    document.body.innerHTML = `
      <div id="node">
        <div class="grounding-card sources-container">
          <div class="source-item">
            <a class="citation-link" href="https://nature.com/articles/quantum-1">
              <span class="source-index">1</span>
              <span class="source-title">Nature - Quantum Physics</span>
              <span class="source-snippet">A summary snippet.</span>
            </a>
          </div>
        </div>
      </div>
    `;
    const node = document.getElementById('node')!;
    const citations = scrapeCitations(node);

    expect(citations).toHaveLength(1);
    expect(citations[0]).toEqual({
      index: '1',
      title: 'Nature - Quantum Physics',
      url: 'https://nature.com/articles/quantum-1',
      snippet: 'A summary snippet.'
    });
  });

  it('returns an empty array when no grounding data is present', () => {
    document.body.innerHTML = `<div id="node"><p>No sources here.</p></div>`;
    const node = document.getElementById('node')!;
    expect(scrapeCitations(node)).toEqual([]);
  });

  it('falls back to a sequential index and link text/href when source-index/title are absent', () => {
    document.body.innerHTML = `
      <div id="node">
        <div class="sources-container">
          <a class="citation-link" href="https://example.com/a">First Source</a>
          <a class="citation-link" href="https://example.com/b">Second Source</a>
        </div>
      </div>
    `;
    const node = document.getElementById('node')!;
    const citations = scrapeCitations(node);

    expect(citations).toHaveLength(2);
    expect(citations[0]).toMatchObject({ index: '1', title: 'First Source', url: 'https://example.com/a' });
    expect(citations[1]).toMatchObject({ index: '2', title: 'Second Source', url: 'https://example.com/b' });
  });

  it('finds citation links even outside a grounding container', () => {
    document.body.innerHTML = `
      <div id="node">
        <a data-citation href="https://example.com/loose">Loose citation</a>
      </div>
    `;
    const node = document.getElementById('node')!;
    const citations = scrapeCitations(node);
    expect(citations).toHaveLength(1);
    expect(citations[0]!.url).toBe('https://example.com/loose');
  });

  it('does not duplicate a link that matches both a grounding container and the loose fallback query', () => {
    document.body.innerHTML = `
      <div id="node">
        <div class="grounding-card">
          <a class="citation-link" href="https://example.com/once">Once</a>
        </div>
      </div>
    `;
    const node = document.getElementById('node')!;
    expect(scrapeCitations(node)).toHaveLength(1);
  });
});
