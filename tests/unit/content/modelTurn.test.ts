import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scrapeModelTurn } from '../../../src/content/scrapers/modelTurn';
import type { ImageAsset } from '../../../src/content/types';

describe('scrapeModelTurn', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['x'], { type: 'image/png' }) })
    );
  });

  it('extracts a plain response body with no thought or citations', async () => {
    document.body.innerHTML = `
      <model-response>
        <div class="response-container">
          <div class="markdown response-content"><p>The answer is 42.</p></div>
        </div>
      </model-response>
    `;
    const node = document.querySelector('model-response')!;
    const images: ImageAsset[] = [];
    const turn = await scrapeModelTurn(node, images, { value: 0 });

    expect(turn.role).toBe('model');
    expect(turn.text).toContain('The answer is 42.');
    expect(turn.thought).toBeUndefined();
    expect(turn.citations).toBeUndefined();
  });

  it('attaches a thought when a thinking trace is present, and removes it from the response html', async () => {
    document.body.innerHTML = `
      <model-response>
        <div class="response-container">
          <div class="thought-container">
            <button class="thought-toggle">Thinking Process (3s)</button>
            <div class="thought-content"><p>Reasoning...</p></div>
          </div>
          <div class="markdown response-content"><p>Final answer.</p></div>
        </div>
      </model-response>
    `;
    const node = document.querySelector('model-response')!;
    const images: ImageAsset[] = [];
    const turn = await scrapeModelTurn(node, images, { value: 0 });

    expect(turn.thought).toBeDefined();
    expect(turn.thought?.duration).toBe('3s');
    expect(turn.html).not.toContain('Reasoning');
    expect(turn.html).toContain('Final answer.');
  });

  it('attaches citations when grounding data is present', async () => {
    document.body.innerHTML = `
      <model-response>
        <div class="response-container">
          <div class="markdown response-content"><p>Cited answer.</p></div>
          <div class="grounding-card">
            <a class="citation-link" href="https://example.com/src">Source</a>
          </div>
        </div>
      </model-response>
    `;
    const node = document.querySelector('model-response')!;
    const images: ImageAsset[] = [];
    const turn = await scrapeModelTurn(node, images, { value: 0 });

    expect(turn.citations).toHaveLength(1);
    expect(turn.citations?.[0]!.url).toBe('https://example.com/src');
  });

  it('normalizes code blocks and restores TeX math within the same response body', async () => {
    document.body.innerHTML = `
      <model-response>
        <div class="response-container">
          <div class="markdown response-content">
            <code-block lang="python"><pre><code>x = 1</code></pre></code-block>
            <span class="math-inline"><annotation encoding="application/x-tex">x^2</annotation></span>
          </div>
        </div>
      </model-response>
    `;
    const node = document.querySelector('model-response')!;
    const images: ImageAsset[] = [];
    const turn = await scrapeModelTurn(node, images, { value: 0 });

    expect(turn.html).toContain('<pre><code class="language-python">x = 1</code></pre>');
    expect(turn.html).toContain('$x^2$');
  });

  it('falls back to the whole node when no markdown/response-content container is found', async () => {
    document.body.innerHTML = `<model-response><p>bare response</p></model-response>`;
    const node = document.querySelector('model-response')!;
    const images: ImageAsset[] = [];
    const turn = await scrapeModelTurn(node, images, { value: 0 });
    expect(turn.text).toContain('bare response');
  });
});
